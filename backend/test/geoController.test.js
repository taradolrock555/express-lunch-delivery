const test = require('node:test');
const assert = require('node:assert/strict');
const { requestOsrmTable } = require('../controllers/geoController');

const coordinates = [
  { latitude: 16.2452, longitude: 103.2501 },
  { latitude: 16.2471, longitude: 103.2534 }
];

test('uses OSRM table distances when the service returns a valid matrix', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ code: 'Ok', distances: [[0, 1234], [1234, 0]] })
  });

  try {
    const result = await requestOsrmTable(coordinates);
    assert.equal(result.source, 'osrm');
    assert.equal(result.distanceKm[0][1], 1.234);
  } finally {
    global.fetch = originalFetch;
  }
});

test('falls back to Haversine distances when OSRM fails', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });

  try {
    const result = await requestOsrmTable(coordinates);
    assert.equal(result.source, 'haversine');
    assert.equal(result.distanceKm[0][0], 0);
    assert.ok(result.distanceKm[0][1] > 0);
    assert.equal(result.distanceKm[0][1], result.distanceKm[1][0]);
  } finally {
    global.fetch = originalFetch;
  }
});
