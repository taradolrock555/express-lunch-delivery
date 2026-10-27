import test from 'node:test';
import assert from 'node:assert/strict';
import { createDistanceOrderSeeds, optimizeRoutes } from '../src/services/routeOptimizer';

const pricing = {
  riderFeePerTrip: 15,
  riderCostPerKmPerBox: 2,
  riderSpeedKmh: 30,
  maxOrdersPerRider: 3,
};

function matrix(size: number, distance = 0): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 0 : distance)),
  );
}

function orders(count: number, boxes = 1) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    totalBoxes: boxes,
  }));
}

function riders(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1 }));
}

test('optimizes stop order using the shortest road-distance permutation', () => {
  const distances = [
    [0, 1, 2, 3],
    [1, 0, 1, 2],
    [2, 1, 0, 1],
    [3, 2, 1, 0],
  ];

  const result = optimizeRoutes(orders(3), riders(1), distances, pricing);

  assert.equal(result.routes.length, 1);
  assert.deepEqual(result.routes[0].orders.map((order) => order.id), [1, 2, 3]);
  assert.equal(result.routes[0].plannedDistanceKm, 3);
});

test('keeps each rider within the three-order limit', () => {
  const result = optimizeRoutes(orders(7), riders(3), matrix(8), pricing);

  assert.equal(result.routes.length, 3);
  assert.ok(result.routes.every((route) => route.orders.length <= pricing.maxOrdersPerRider));
  assert.equal(result.routes.reduce((total, route) => total + route.orders.length, 0), 7);
});

test('keeps manual rider overrides while assigning the remaining orders automatically', () => {
  const fixedRiderByOrder = new Map([[0, 2], [1, 2]]);
  const result = optimizeRoutes(
    orders(7),
    riders(3),
    matrix(8, 1),
    pricing,
    60,
    [],
    fixedRiderByOrder,
  );

  assert.equal(result.error, undefined);
  const pinnedRoutes = result.routes.filter((route) => route.rider.id === 2);
  assert.equal(pinnedRoutes.length, 1);
  assert.ok(pinnedRoutes[0].orders.some((order) => order.id === 1));
  assert.ok(pinnedRoutes[0].orders.some((order) => order.id === 2));
  assert.ok(result.routes.every((route) => route.orders.length <= 3));
  assert.equal(result.routes.reduce((count, route) => count + route.orders.length, 0), 7);
});

test('supports the assignment maximum of 30 orders and 10 riders', () => {
  const result = optimizeRoutes(orders(30), riders(10), matrix(31), pricing);

  assert.equal(result.routes.length, 10);
  assert.ok(result.routes.every((route) => route.orders.length === 3));
});

test('balances the number of orders between active riders when cost is equal', () => {
  const result = optimizeRoutes(orders(6), riders(3), matrix(7), pricing);
  const counts = result.routes.map((route) => route.orders.length).sort();

  assert.deepEqual(counts, [3, 3]);
});

test('uses separate trips when their delivery charge is lower', () => {
  const distances = matrix(3, 10);
  distances[0][1] = 10;
  distances[0][2] = 10;
  distances[1][0] = 10;
  distances[2][0] = 10;

  const result = optimizeRoutes(orders(2), riders(2), distances, pricing);

  assert.equal(result.routes.length, 2);
  assert.equal(result.cost, 70);
});

test('builds near-to-far and far-to-near route groupings from shop distances', () => {
  const distances = [
    [0, 5, 1, 3, 2],
    [5, 0, 1, 1, 1],
    [1, 1, 0, 1, 1],
    [3, 1, 1, 0, 1],
    [2, 1, 1, 1, 0],
  ];
  const seeds = createDistanceOrderSeeds(orders(4), riders(2), distances, 3);

  assert.deepEqual(
    seeds.map((seed) => seed.method),
    [
      'near-to-far round-robin',
      'far-to-near round-robin',
      'near-to-far grouped',
      'far-to-near grouped',
    ],
  );
  assert.deepEqual(seeds[0].groups, [[1, 2], [3, 0]]);
  assert.deepEqual(seeds[1].groups, [[0, 3], [2, 1]]);
  assert.deepEqual(seeds[2].groups, [[1, 3], [2, 0]]);
  assert.deepEqual(seeds[3].groups, [[0, 2], [3, 1]]);
});

test('reports cost and distance for supplied distance-order candidates', () => {
  const distances = matrix(3, 10);
  distances[0][1] = 10;
  distances[0][2] = 10;
  distances[1][0] = 10;
  distances[2][0] = 10;

  const candidate = { method: 'near-to-far grouped' as const, groups: [[0], [1]] };
  const result = optimizeRoutes(orders(2), riders(2), distances, pricing, 60, [candidate]);

  assert.equal(result.routes.length, 2);
  assert.equal(result.cost, 70);
  assert.ok(
    result.comparisons.some(
      (comparison) =>
        comparison.method === candidate.method && comparison.deliveryCost === 70,
    ),
  );
});

test('reports when even a single order cannot meet the one-hour deadline', () => {
  const distances = matrix(2);
  distances[0][1] = 31;

  const result = optimizeRoutes(orders(1), riders(1), distances, pricing);

  assert.match(result.error ?? '', /12:30/);
});
