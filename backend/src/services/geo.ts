import { pricing } from '../config/delivery';
import type { RouteGeometry } from '../types';
import { badRequest } from '../utils/errors';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteMetrics {
  distanceKm: number;
  durationMinutes: number;
  geometry: RouteGeometry;
  source: 'osrm' | 'haversine';
}

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS) || 3000;
const EARTH_RADIUS_KM = 6371;

export function normalizeCoordinates(input: unknown): Coordinate[] {
  if (!Array.isArray(input) || input.length < 2) {
    throw badRequest('ต้องส่งพิกัดอย่างน้อย 2 จุดเพื่อคำนวณเส้นทาง');
  }

  return input.map((point) => {
    const latitude = Number((point as Coordinate | undefined)?.latitude);
    const longitude = Number((point as Coordinate | undefined)?.longitude);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw badRequest(
        'พิกัดไม่ถูกต้อง: latitude ต้องอยู่ระหว่าง -90 ถึง 90 และ longitude ต้องอยู่ระหว่าง -180 ถึง 180',
      );
    }
    return { latitude, longitude };
  });
}

export function haversineDistanceKm(from: Coordinate, to: Coordinate): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function pathDistanceKm(coordinates: Coordinate[]): number {
  return coordinates
    .slice(1)
    .reduce((total, point, index) => total + haversineDistanceKm(coordinates[index], point), 0);
}

export function fallbackRoute(coordinates: Coordinate[]): RouteMetrics {
  const distanceKm = pathDistanceKm(coordinates);
  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMinutes: Number(((distanceKm / pricing.riderSpeedKmh) * 60).toFixed(1)),
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map(({ latitude, longitude }) => [longitude, latitude]),
    },
    source: 'haversine',
  };
}

export function fallbackDistanceMatrix(coordinates: Coordinate[]): number[][] {
  return coordinates.map((from) => coordinates.map((to) => haversineDistanceKm(from, to)));
}

function coordinatePath(coordinates: Coordinate[]): string {
  return coordinates.map(({ latitude, longitude }) => `${longitude},${latitude}`).join(';');
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`OSRM request failed with status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestOsrmTable(
  coordinates: Coordinate[],
): Promise<{ distanceKm: number[][]; source: 'osrm' | 'haversine' }> {
  const url = `${OSRM_BASE_URL}/table/v1/driving/${coordinatePath(coordinates)}?annotations=distance`;
  try {
    const result = (await fetchJson(url)) as {
      code?: string;
      distances?: unknown;
    };
    const distances = result.code === 'Ok' ? result.distances : null;
    const valid =
      Array.isArray(distances) &&
      distances.length === coordinates.length &&
      distances.every(
        (row) => Array.isArray(row) && row.length === coordinates.length,
      );
    if (!valid) {
      throw new Error('OSRM returned an invalid distance matrix');
    }

    const fallback = fallbackDistanceMatrix(coordinates);
    let usedFallback = false;
    const distanceKm = (distances as unknown[][]).map((row, rowIndex) =>
      row.map((distance, columnIndex) => {
        const value = Number(distance);
        if (Number.isFinite(value) && value >= 0) {
          return value / 1000;
        }
        usedFallback = true;
        return fallback[rowIndex][columnIndex];
      }),
    );

    return { distanceKm, source: usedFallback ? 'haversine' : 'osrm' };
  } catch (error) {
    console.warn(
      `OSRM distance table failed; using Haversine fallback: ${(error as Error).message}`,
    );
    return { distanceKm: fallbackDistanceMatrix(coordinates), source: 'haversine' };
  }
}

export async function requestOsrmRoute(coordinates: Coordinate[]): Promise<RouteMetrics> {
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinatePath(coordinates)}?overview=full&geometries=geojson`;
  try {
    const result = (await fetchJson(url)) as {
      code?: string;
      routes?: Array<{ distance?: number; duration?: number; geometry?: RouteGeometry }>;
    };
    const route = result.code === 'Ok' ? result.routes?.[0] : undefined;
    if (
      !route ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration) ||
      !route.geometry
    ) {
      throw new Error('OSRM returned no valid route');
    }

    return {
      distanceKm: Number(((route.distance as number) / 1000).toFixed(2)),
      durationMinutes: Number(((route.duration as number) / 60).toFixed(1)),
      geometry: route.geometry,
      source: 'osrm',
    };
  } catch (error) {
    console.warn(
      `OSRM route request failed; using Haversine fallback: ${(error as Error).message}`,
    );
    return fallbackRoute(coordinates);
  }
}
