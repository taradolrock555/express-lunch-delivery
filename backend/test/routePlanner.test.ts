import test from 'node:test';
import assert from 'node:assert/strict';

async function withPlanner<T>(run: (context: {
  store: InstanceType<(typeof import('../src/db/sqlite'))['SqliteStore']>;
  computePlan: typeof import('../src/services/routePlanner').computePlan;
  getRiderTask: typeof import('../src/services/routePlanner').getRiderTask;
  publishPlan: typeof import('../src/services/routePlanner').publishPlan;
  parseCustomerInput: typeof import('../src/services/customerValidation').parseCustomerInput;
}) => Promise<T>): Promise<T> {
  process.env.SQLITE_FILE = ':memory:';
  process.env.OSRM_BASE_URL = 'http://127.0.0.1:9';
  const [{ SqliteStore }, planner, validation] = await Promise.all([
    import('../src/db/sqlite'),
    import('../src/services/routePlanner'),
    import('../src/services/customerValidation'),
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 503 });
  try {
    const store = new SqliteStore(':memory:');
    await store.init();
    return await run({ store, ...planner, ...validation });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('automatically assigns all ready orders within rider capacity and keeps manual overrides', async () => {
  await withPlanner(async ({ store, computePlan }) => {
    const beforeOverride = await computePlan('alternative', store);
    const plannedStops = beforeOverride.routes.flatMap((route) =>
      route.stops.map((stop) => ({ ...stop, assignedRiderId: route.rider.id })),
    );
    assert.equal(plannedStops.length, 20);
    assert.equal(new Set(plannedStops.map((stop) => stop.id)).size, 20);
    assert.ok(beforeOverride.routes.every((route) => route.stops.length <= 3));
    assert.ok(beforeOverride.routes.every((route) => route.meetsDeadline));
    assert.ok(beforeOverride.optimizationMethod);

    await store.updateOrder(1, { riderId: 2, assignmentMode: 'manual' });
    const afterOverride = await computePlan('alternative', store);
    const pinnedRoute = afterOverride.routes.find((route) => route.rider.id === 2);
    assert.ok(pinnedRoute?.stops.some((stop) => stop.id === 1));
    assert.equal(
      afterOverride.routes.filter((route) => route.stops.some((stop) => stop.id === 1)).length,
      1,
    );
  });
});

test('plans the full 30-order assignment across 10 riders', async () => {
  await withPlanner(async ({ store, computePlan }) => {
    await store.updateOrder(21, { status: 'ready' });
    await store.updateOrder(22, { status: 'ready' });
    for (let customerId = 23; customerId <= 30; customerId += 1) {
      const order = await store.createOrder(customerId, (customerId % 3) + 1, null);
      await store.updateOrder(order.id, { status: 'ready' });
    }

    const plan = await computePlan('alternative', store);
    assert.equal(plan.routes.reduce((count, route) => count + route.stops.length, 0), 30);
    assert.equal(plan.routes.length, 10);
    assert.ok(plan.routes.every((route) => route.stops.length === 3));
    assert.ok(plan.routes.every((route) => route.meetsDeadline));
  });
});

test('publishes auto assignments with the plan and returns the same rider task', async () => {
  await withPlanner(async ({ store, getRiderTask, publishPlan }) => {
    const plan = await publishPlan('alternative', store);
    const orders = await store.listOrders();
    const assignments = new Map(
      plan.routes.flatMap((route) => route.stops.map((stop) => [stop.id, route.rider.id] as const)),
    );
    for (const order of orders.filter((item) => item.status === 'ready')) {
      assert.equal(order.riderId, assignments.get(order.id));
      assert.equal(order.assignmentMode, 'auto');
    }

    const firstRoute = plan.routes[0];
    const task = await getRiderTask(firstRoute.rider.jobCode, store);
    assert.equal(task.rider.id, firstRoute.rider.id);
    assert.deepEqual(task.stops.map((stop) => stop.id), firstRoute.stops.map((stop) => stop.id));
  });
});

test('does not publish a plan with routes that miss the delivery deadline', async () => {
  await withPlanner(async ({ store, computePlan, publishPlan }) => {
    const customer = await store.getCustomer(1);
    assert.ok(customer);
    await store.updateCustomer(1, { ...customer, latitude: 16.8 });

    const preview = await computePlan('nearest', store);
    assert.equal(preview.totals.allRoutesMeetDeadline, false);
    await assert.rejects(
      () => publishPlan('nearest', store),
      /ถึงหลัง 12:30/,
    );
    assert.equal(await store.getRoutePlan(), null);
    assert.equal((await store.getOrder(1))?.riderId, null);
  });
});

test('rejects customer coordinates outside the three-kilometre service radius', () => {
  const customer = {
    name: 'ลูกค้าทดสอบ',
    phone: '0800000000',
    address: 'ทดสอบ',
    latitude: 16.2452,
    longitude: 103.2501,
  };
  return withPlanner(async ({ parseCustomerInput }) => {
    assert.equal(parseCustomerInput(customer).longitude, customer.longitude);
    assert.throws(
      () => parseCustomerInput({ ...customer, latitude: 16.30, longitude: 103.25 }),
      /ภายในรัศมี 3 กม/,
    );
  });
});
