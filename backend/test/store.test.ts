import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/db/sqlite';
import type { RoutePlan } from '../src/types';

test('seeds the sample data when the database is empty', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();

  const customers = await store.listCustomers();
  const riders = await store.listRiders();
  const orders = await store.listOrders();

  assert.equal(customers.length, 30);
  assert.equal(riders.length, 10);
  assert.equal(orders.length, 22);
  assert.equal(riders[0].jobCode, 'JOB-001');
  assert.ok(orders.some((order) => order.status === 'ready'));
  assert.ok(orders.every((order) => order.riderId === null));
  assert.ok(orders.every((order) => order.assignmentMode === 'auto'));
});

test('creates, updates and deletes a customer', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();

  const created = await store.createCustomer({
    name: 'ทดสอบ ระบบ',
    phone: '0899999999',
    address: 'หอพักทดสอบ',
    latitude: 16.25,
    longitude: 103.25,
  });
  assert.ok(created.id > 0);

  const updated = await store.updateCustomer(created.id, {
    ...created,
    name: 'ทดสอบ แก้ไข',
  });
  assert.equal(updated?.name, 'ทดสอบ แก้ไข');

  const deleted = await store.deleteCustomer(created.id);
  assert.equal(deleted?.id, created.id);
  assert.equal(await store.getCustomer(created.id), null);
});

test('creates and updates an order within the three-box rule', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();

  const order = await store.createOrder(1, 3, 1);
  assert.equal(order.totalBoxes, 3);
  assert.equal(order.riderId, 1);
  assert.equal(order.assignmentMode, 'manual');
  assert.equal(order.status, 'pending');

  const updated = await store.updateOrder(order.id, {
    status: 'ready',
    totalBoxes: 2,
    riderId: 2,
  });
  assert.equal(updated?.status, 'ready');
  assert.equal(updated?.totalBoxes, 2);
  assert.equal(updated?.riderId, 2);

  const deleted = await store.deleteOrder(order.id);
  assert.equal(deleted?.id, order.id);
});

test('creates auto-assigned orders without choosing a rider', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();
  const customer = await store.createCustomer({
    name: 'ลูกค้าทดสอบ',
    phone: '0899999999',
    address: 'ใกล้ร้าน',
    latitude: 16.2452,
    longitude: 103.2501,
  });
  const order = await store.createOrder(customer.id, 2, null);
  assert.equal(order.riderId, null);
  assert.equal(order.assignmentMode, 'auto');
});

test('persists and clears the published route plan', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();

  const plan = {
    strategy: 'alternative',
    planDate: '2026-10-27',
    publishedAt: new Date().toISOString(),
    shop: { name: 'shop', address: 'address', latitude: 16.2452, longitude: 103.2501 },
    pricing: {
      salePricePerBox: 65,
      foodCostPerBox: 40,
      riderFeePerTrip: 15,
      riderCostPerKmPerBox: 2,
      riderSpeedKmh: 30,
      departureTime: '11:30',
      deadlineTime: '12:30',
      maxBoxesPerOrder: 3,
      maxOrdersPerRider: 3,
      maxCustomerDistanceKm: 3,
      dailyDeliveryBudget: 500,
      targetProfit: 300,
    },
    totals: {
      totalBoxes: 0,
      distanceKm: 0,
      totalTravelMinutes: 0,
      revenue: 0,
      foodCost: 0,
      deliveryCost: 0,
      profit: 0,
      allRoutesMeetDeadline: true,
      budget: 500,
      overBudget: false,
      targetProfit: 300,
      belowTargetProfit: false,
    },
    routes: [],
  } satisfies RoutePlan;

  await store.saveRoutePlan(plan);
  const saved = await store.getRoutePlan();
  assert.equal(saved?.planDate, '2026-10-27');

  await store.clearRoutePlan();
  assert.equal(await store.getRoutePlan(), null);
});

test('publishes an automatic rider assignment with the route plan atomically', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();
  const plan = {
    strategy: 'alternative',
    planDate: '2026-10-27',
    publishedAt: new Date().toISOString(),
    shop: { name: 'shop', address: 'address', latitude: 16.2452, longitude: 103.2501 },
    pricing: {
      salePricePerBox: 65,
      foodCostPerBox: 40,
      riderFeePerTrip: 15,
      riderCostPerKmPerBox: 2,
      riderSpeedKmh: 30,
      departureTime: '11:30',
      deadlineTime: '12:30',
      maxBoxesPerOrder: 3,
      maxOrdersPerRider: 3,
      maxCustomerDistanceKm: 3,
      dailyDeliveryBudget: 500,
      targetProfit: 300,
    },
    totals: {
      totalBoxes: 0,
      distanceKm: 0,
      totalTravelMinutes: 0,
      revenue: 0,
      foodCost: 0,
      deliveryCost: 0,
      profit: 0,
      allRoutesMeetDeadline: true,
      budget: 500,
      overBudget: false,
      targetProfit: 300,
      belowTargetProfit: false,
    },
    routes: [],
  } satisfies RoutePlan;

  await store.saveRoutePlan(plan, [{ orderId: 1, riderId: 3 }]);
  const order = await store.getOrder(1);
  assert.equal(order?.riderId, 3);
  assert.equal(order?.assignmentMode, 'auto');
  assert.equal((await store.getRoutePlan())?.publishedAt, plan.publishedAt);
});

test('protects customers that still have orders', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();

  assert.equal(await store.customerHasOrders(1), true);
  assert.equal(await store.customerHasOrders(999), false);
});

test('counts only active orders for the one-order-per-customer rule', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();

  assert.equal(await store.countActiveOrders({ customerId: 1 }), 1);
  await store.updateOrder(1, { status: 'delivered' });
  assert.equal(await store.countActiveOrders({ customerId: 1 }), 0);
});

test('counts active orders per rider while excluding the edited order', async () => {
  const store = new SqliteStore(':memory:');
  await store.init();

  for (const orderId of [1, 2, 3]) {
    await store.updateOrder(orderId, { riderId: 1, assignmentMode: 'manual' });
  }

  assert.equal(await store.countActiveOrders({ riderId: 1 }), 3);
  assert.equal(await store.countActiveOrders({ riderId: 1, excludeOrderId: 1 }), 2);
});
