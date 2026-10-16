const { pricing } = require('../config/delivery');
const asyncHandler = require('../utils/asyncHandler');

const osrmBaseUrl = 'https://router.project-osrm.org/route/v1/driving';
const osrmTimeoutMs = 3000;
const earthRadiusKm = 6371;

function normalizeCoordinates(input) {
  if (!Array.isArray(input) || input.length < 2) {
    return { error: 'กรุณาระบุพิกัดอย่างน้อย 2 จุด' };
  }

  const coordinates = [];
  for (const point of input) {
    const latitude = Number(point?.latitude);
    const longitude = Number(point?.longitude);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return { error: 'พิกัดแต่ละจุดต้องมี latitude ระหว่าง -90 ถึง 90 และ longitude ระหว่าง -180 ถึง 180' };
    }
    coordinates.push({ latitude, longitude });
  }

  return { coordinates };
}

function haversineDistanceKm(coordinates) {
  return coordinates.slice(1).reduce((total, point, index) => {
    const previous = coordinates[index];
    const latitudeDelta = ((point.latitude - previous.latitude) * Math.PI) / 180;
    const longitudeDelta = ((point.longitude - previous.longitude) * Math.PI) / 180;
    const value =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos((previous.latitude * Math.PI) / 180) *
        Math.cos((point.latitude * Math.PI) / 180) *
        Math.sin(longitudeDelta / 2) ** 2;

    return total + earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }, 0);
}

function fallbackRoute(coordinates) {
  const distanceKm = haversineDistanceKm(coordinates);
  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMinutes: Number(((distanceKm / pricing.riderSpeedKmh) * 60).toFixed(1)),
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map(({ latitude, longitude }) => [longitude, latitude])
    },
    source: 'haversine'
  };
}

function fallbackDistanceMatrix(coordinates) {
  return coordinates.map((from) => coordinates.map((to) => haversineDistanceKm([from, to])));
}

async function requestOsrmTable(coordinates) {
  const coordinatePath = coordinates
    .map(({ latitude, longitude }) => `${longitude},${latitude}`)
    .join(';');
  const url = `https://router.project-osrm.org/table/v1/driving/${coordinatePath}?annotations=distance`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), osrmTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`OSRM table request failed with status ${response.status}`);
    }

    const result = await response.json();
    const distances = result.code === 'Ok' ? result.distances : null;
    const validMatrix = Array.isArray(distances) &&
      distances.length === coordinates.length &&
      distances.every((row) => Array.isArray(row) && row.length === coordinates.length);
    if (!validMatrix) {
      throw new Error('OSRM returned an invalid distance matrix');
    }

    const fallback = fallbackDistanceMatrix(coordinates);
    let usedFallback = false;
    const distanceKm = distances.map((row, rowIndex) =>
      row.map((distance, columnIndex) => {
        if (Number.isFinite(distance) && distance >= 0) {
          return distance / 1000;
        }
        usedFallback = true;
        return fallback[rowIndex][columnIndex];
      })
    );

    return { distanceKm, source: usedFallback ? 'haversine' : 'osrm' };
  } catch (error) {
    console.warn(`OSRM distance table failed; using Haversine fallback: ${error.message}`);
    return { distanceKm: fallbackDistanceMatrix(coordinates), source: 'haversine' };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOsrmRoute(coordinates) {
  const coordinatePath = coordinates
    .map(({ latitude, longitude }) => `${longitude},${latitude}`)
    .join(';');
  const url = `${osrmBaseUrl}/${coordinatePath}?overview=full&geometries=geojson`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), osrmTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`OSRM request failed with status ${response.status}`);
    }

    const result = await response.json();
    const route = result.code === 'Ok' && result.routes?.[0];
    if (
      !route ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.duration) ||
      !route.geometry
    ) {
      throw new Error('OSRM returned no valid route');
    }

    return {
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMinutes: Number((route.duration / 60).toFixed(1)),
      geometry: route.geometry,
      source: 'osrm'
    };
  } catch (error) {
    console.warn(`OSRM route request failed; using Haversine fallback: ${error.message}`);
    return fallbackRoute(coordinates);
  } finally {
    clearTimeout(timeout);
  }
}

const getGeoRoute = asyncHandler(async (req, res) => {
  const input = req.body && typeof req.body === 'object' ? req.body : {};
  const result = normalizeCoordinates(input.coordinates);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const route = await requestOsrmRoute(result.coordinates);
  return res.json({ success: true, data: route });
});

module.exports = { getGeoRoute, requestOsrmRoute, requestOsrmTable };
