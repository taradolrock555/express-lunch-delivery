const test = require('node:test');
const assert = require('node:assert/strict');
const mockData = require('../data/mockData');

test('sample data covers a 20-order route-planning scenario', () => {
  const readyOrders = mockData.orders.filter((order) => order.status === 'ready');
  const pendingOrders = mockData.orders.filter((order) => order.status === 'pending');
  const availableRiders = mockData.riders.filter((rider) => rider.status === 'available');

  assert.equal(mockData.customers.length, 20);
  assert.equal(readyOrders.length, 20);
  assert.equal(pendingOrders.length, 2);
  assert.equal(availableRiders.length, 7);
  assert.ok(readyOrders.every((order) => order.totalBoxes >= 1 && order.totalBoxes <= 3));
  assert.ok(readyOrders.every((order) =>
    mockData.customers.some((customer) => customer.id === order.customerId)
  ));
  assert.equal(new Set(readyOrders.map((order) => order.customerId)).size, readyOrders.length);
  assert.ok(readyOrders.length <= availableRiders.length * mockData.pricing.maxOrdersPerRider);
  assert.equal(mockData.nextCustomerId, 21);
  assert.equal(mockData.nextOrderId, 23);
});
