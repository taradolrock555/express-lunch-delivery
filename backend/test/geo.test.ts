import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fallbackRoute,
  haversineDistanceKm,
  normalizeCoordinates,
} from '../src/services/geo';

test('calculates straight-line distance between two coordinates', () => {
  const distance = haversineDistanceKm(
    { latitude: 16.2452, longitude: 103.2501 },
    { latitude: 16.2471, longitude: 103.2534 },
  );
  assert.ok(distance > 0.3 && distance < 0.5);
});

test('accepts valid coordinate payloads', () => {
  const coordinates = normalizeCoordinates([
    { latitude: 16.2452, longitude: 103.2501 },
    { latitude: 16.2471, longitude: 103.2534 },
  ]);
  assert.equal(coordinates.length, 2);
});

test('rejects invalid coordinate payloads', () => {
  assert.throws(() => normalizeCoordinates([{ latitude: 16.2, longitude: 103.2 }]), /อย่างน้อย 2 จุด/);
  assert.throws(
    () =>
      normalizeCoordinates([
        { latitude: 91, longitude: 103.2 },
        { latitude: 16.2, longitude: 103.2 },
      ]),
    /latitude/,
  );
});

test('builds a haversine fallback route with GeoJSON geometry', () => {
  const route = fallbackRoute([
    { latitude: 16.2452, longitude: 103.2501 },
    { latitude: 16.2471, longitude: 103.2534 },
  ]);

  assert.equal(route.source, 'haversine');
  assert.equal(route.geometry.type, 'LineString');
  assert.equal(route.geometry.coordinates.length, 2);
  assert.ok(route.distanceKm > 0);
  assert.ok(route.durationMinutes > 0);
});
