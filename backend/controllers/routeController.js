const { db } = require('../config/firebase');
const { pricing, shop } = require('../config/delivery');
const asyncHandler = require('../utils/asyncHandler');
const { requestOsrmRoute, requestOsrmTable } = require('./geoController');
const { createDistanceOrderSeeds, optimizeRoutes, permutations } = require('../utils/routeOptimizer');

let currentRoutePlan = null;

const radians = (degrees) => (degrees * Math.PI) / 180;

function distanceKm(from, to) {
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function timeOfDayMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function deliveryWindowMinutes() {
  const departure = timeOfDayMinutes(pricing.departureTime);
  let deadline = timeOfDayMinutes(pricing.deadlineTime);
  if (deadline < departure) {
    deadline += 24 * 60;
  }
  return deadline - departure;
}

function sortById(snapshot) {
  return snapshot.docs
    .map((document) => document.data())
    .sort((a, b) => a.id - b.id);
}

async function loadData() {
  const [customers, orders, riders] = await Promise.all([
    db.collection('customers').get(),
    db.collection('orders').get(),
    db.collection('riders').get()
  ]);

  return {
    shop,
    pricing,
    customers: sortById(customers),
    orders: sortById(orders),
    riders: sortById(riders)
  };
}

function orderWithCustomer(order, data) {
  const customer = data.customers.find((item) => item.id === order.customerId);
  return {
    ...order,
    customerName: customer ? customer.name : 'ไม่พบข้อมูลลูกค้า',
    address: customer ? customer.address : '',
    latitude: customer ? customer.latitude : data.shop.latitude,
    longitude: customer ? customer.longitude : data.shop.longitude
  };
}

function distributeOrders(orders, riders, strategy) {
  const groups = riders.map((rider) => ({ rider, orders: [] }));
  const sortedOrders = [...orders].sort((a, b) => {
    if (strategy === 'alternative') {
      return b.id - a.id;
    }
    return distanceKm(shop, a) - distanceKm(shop, b);
  });

  sortedOrders.forEach((order, index) => {
    groups[index % groups.length].orders.push(order);
  });

  return groups;
}

function orderStops(group, strategy) {
  const remaining = [...group.orders];
  if (strategy === 'alternative') {
    return remaining.sort((a, b) => b.id - a.id);
  }

  const ordered = [];
  let current = shop;
  while (remaining.length > 0) {
    let closestIndex = 0;
    for (let index = 1; index < remaining.length; index += 1) {
      if (distanceKm(current, remaining[index]) < distanceKm(current, remaining[closestIndex])) {
        closestIndex = index;
      }
    }
    const [next] = remaining.splice(closestIndex, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

async function makeRoute(group, strategy, data, routeMetricsCache) {
  const candidateOrders = strategy === 'alternative'
    ? permutations(group.orders)
    : [orderStops(group, strategy)];
  const routeCandidates = await Promise.all(candidateOrders.map(async (orders) => {
    const cacheKey = orders.map((order) => order.id).join(',');
    if (!routeMetricsCache.has(cacheKey)) {
      routeMetricsCache.set(cacheKey, requestOsrmRoute([
        data.shop,
        ...orders
      ].map(({ latitude, longitude }) => ({ latitude, longitude }))));
    }
    return { orders, metrics: await routeMetricsCache.get(cacheKey) };
  }));
  const bestCandidate = routeCandidates.reduce((best, candidate) =>
    !best ||
    candidate.metrics.distanceKm < best.metrics.distanceKm ||
    (
      candidate.metrics.distanceKm === best.metrics.distanceKm &&
      candidate.metrics.durationMinutes < best.metrics.durationMinutes
    )
      ? candidate
      : best
  , null);
  const stops = bestCandidate.orders.map((order, index) => ({
    ...orderWithCustomer(order, data),
    sequenceNumber: index + 1
  }));

  const routeMetrics = bestCandidate.metrics;
  const distance = routeMetrics.distanceKm;
  const totalBoxes = stops.reduce((sum, stop) => sum + stop.totalBoxes, 0);
  const travelMinutes = (distance / pricing.riderSpeedKmh) * 60;
  const revenue = totalBoxes * pricing.salePricePerBox;
  const foodCost = totalBoxes * pricing.foodCostPerBox;
  const deliveryCost = stops.length > 0
    ? pricing.riderFeePerTrip +
      distance * pricing.riderCostPerKmPerBox * totalBoxes
    : 0;
  const departureMinutes = timeOfDayMinutes(pricing.departureTime);
  const arrivalMinutes = departureMinutes + Math.ceil(travelMinutes);
  const arrivalClockMinutes = arrivalMinutes % (24 * 60);
  const arrivalHours = Math.floor(arrivalClockMinutes / 60);
  const arrivalMinute = arrivalClockMinutes % 60;

  return {
    rider: group.rider,
    stops,
    totalBoxes,
    geometry: routeMetrics.geometry,
    distanceSource: routeMetrics.source,
    distanceKm: Number(distance.toFixed(2)),
    travelMinutes: Math.ceil(travelMinutes),
    revenue: Number(revenue.toFixed(2)),
    foodCost: Number(foodCost.toFixed(2)),
    deliveryCost: Number(deliveryCost.toFixed(2)),
    profit: Number((revenue - foodCost - deliveryCost).toFixed(2)),
    estimatedArrival: `${String(arrivalHours).padStart(2, '0')}:${String(arrivalMinute).padStart(2, '0')}`,
    meetsDeadline: Math.ceil(travelMinutes) <= deliveryWindowMinutes()
  };
}

async function buildPreview(strategy, data) {
  const readyOrders = data.orders
    .filter((order) => order.status === 'ready')
    .map((order) => orderWithCustomer(order, data));
  const availableRiders = data.riders.filter((rider) => rider.status === 'available');
  const capacity = availableRiders.length * pricing.maxOrdersPerRider;

  if (readyOrders.length > 0 && availableRiders.length === 0) {
    return { error: 'ไม่มีไรเดอร์ที่พร้อมรับงานในขณะนี้', status: 409 };
  }
  if (readyOrders.length > capacity) {
    return {
      error: `มีออเดอร์พร้อมส่ง ${readyOrders.length} รายการ แต่ไรเดอร์ที่พร้อมรับงานรองรับได้ ${capacity} รายการ`,
      status: 409
    };
  }

  let groups = [];
  const routeMetricsCache = new Map();
  let optimizationSource;
  let optimizationMethod;
  let optimizationComparisons;
  let optimizationComparisonMethod;
  let plannedRoutes;
  if (readyOrders.length > 0 && strategy === 'alternative') {
    const table = await requestOsrmTable([
      data.shop,
      ...readyOrders
    ].map(({ latitude, longitude }) => ({ latitude, longitude })));
    const seedCandidates = createDistanceOrderSeeds(
      readyOrders,
      availableRiders,
      table.distanceKm,
      pricing.maxOrdersPerRider
    );
    const optimization = optimizeRoutes(
      readyOrders,
      availableRiders,
      table.distanceKm,
      pricing,
      deliveryWindowMinutes(),
      seedCandidates
    );
    if (optimization.error) {
      return { error: optimization.error, status: 409 };
    }
    optimizationSource = table.source;
    if (readyOrders.length <= 9) {
      const evaluatedCandidates = await Promise.all(optimization.solutions.map(async (solution) => {
        const candidateGroups = solution.routes.map((route, index) => ({
          rider: availableRiders[index],
          orders: route.orderIndexes.map((orderIndex) => readyOrders[orderIndex])
        }));
        const routes = await Promise.all(
          candidateGroups.map((group) => makeRoute(group, strategy, data, routeMetricsCache))
        );
        return {
          method: solution.method,
          routes,
          distanceKm: routes.reduce((total, route) => total + route.distanceKm, 0),
          deliveryCost: routes.reduce((total, route) => total + route.deliveryCost, 0),
          meetsDeadline: routes.every((route) => route.meetsDeadline)
        };
      }));
      optimizationComparisons = evaluatedCandidates.map((candidate) => ({
        method: candidate.method,
        distanceKm: Number(candidate.distanceKm.toFixed(2)),
        deliveryCost: Number(candidate.deliveryCost.toFixed(2))
      }));
      const feasibleCandidates = evaluatedCandidates.filter((candidate) => candidate.meetsDeadline);
      if (feasibleCandidates.length === 0) {
        return {
          error: 'ไม่สามารถจัดออเดอร์ให้ทุกเส้นทางถึงภายใน 12:30 น. ด้วยจำนวนไรเดอร์ที่พร้อมได้',
          status: 409
        };
      }
      const selectedCandidate = feasibleCandidates.reduce((best, candidate) =>
        Number(candidate.deliveryCost.toFixed(2)) < Number(best.deliveryCost.toFixed(2))
          ? candidate
          : best
      );
      optimizationMethod = selectedCandidate.method;
      plannedRoutes = selectedCandidate.routes;
      optimizationComparisonMethod = 'route';
    } else {
      groups = optimization.routes;
      optimizationMethod = optimization.method;
      optimizationComparisons = optimization.comparisons;
      optimizationComparisonMethod = 'table';
    }
  } else if (readyOrders.length > 0) {
    groups = distributeOrders(readyOrders, availableRiders, strategy)
      .filter((group) => group.orders.length > 0);
  }

  const routes = plannedRoutes || await Promise.all(
    groups.map((group) => makeRoute(group, strategy, data, routeMetricsCache))
  );
  const totals = routes.reduce((result, route) => ({
    totalBoxes: result.totalBoxes + route.totalBoxes,
    distanceKm: result.distanceKm + route.distanceKm,
    revenue: result.revenue + route.revenue,
    foodCost: result.foodCost + route.foodCost,
    deliveryCost: result.deliveryCost + route.deliveryCost,
    profit: result.profit + route.profit,
    allRoutesMeetDeadline: result.allRoutesMeetDeadline && route.meetsDeadline
  }), {
    totalBoxes: 0,
    distanceKm: 0,
    revenue: 0,
    foodCost: 0,
    deliveryCost: 0,
    profit: 0,
    allRoutesMeetDeadline: true
  });

  totals.distanceKm = Number(totals.distanceKm.toFixed(2));
  totals.revenue = Number(totals.revenue.toFixed(2));
  totals.foodCost = Number(totals.foodCost.toFixed(2));
  totals.deliveryCost = Number(totals.deliveryCost.toFixed(2));
  totals.profit = Number(totals.profit.toFixed(2));

  return {
    data: {
      strategy,
      shop: data.shop,
      pricing,
      ...(optimizationSource ? { optimizationSource } : {}),
      ...(optimizationMethod ? { optimizationMethod } : {}),
      ...(optimizationComparisons ? { optimizationComparisons } : {}),
      ...(optimizationComparisonMethod ? { optimizationComparisonMethod } : {}),
      totals,
      routes: plannedRoutes || routes
    }
  };
}

const previewRoutes = asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const strategy = body.strategy === 'alternative' ? 'alternative' : 'nearest';
  const result = await buildPreview(strategy, await loadData());
  if (result.error) {
    return res.status(result.status).json({ message: result.error });
  }
  currentRoutePlan = result.data;
  return res.json({ success: true, data: result.data });
});

const getRiderTask = asyncHandler(async (req, res) => {
  const data = await loadData();
  const rider = data.riders.find((item) => item.jobCode.toLowerCase() === req.params.jobCode.toLowerCase());
  if (!rider) {
    return res.status(404).json({ message: 'ไม่พบเลขใบงาน กรุณาตรวจสอบรหัสอีกครั้ง' });
  }

  let routePlan = currentRoutePlan;
  if (!routePlan) {
    const result = await buildPreview('nearest', data);
    if (result.error) {
      return res.status(result.status).json({ message: result.error });
    }
    routePlan = result.data;
  }
  const route = routePlan.routes.find((item) => item.rider.id === rider.id);
  if (!route) {
    return res.status(404).json({ message: 'ยังไม่มีงานที่มอบหมายให้เลขใบงานนี้' });
  }

  return res.json({
    success: true,
    data: {
      jobCode: rider.jobCode,
      rider,
      shop: routePlan.shop,
      ...route
    }
  });
});

function invalidateRoutePlan() {
  currentRoutePlan = null;
}

module.exports = { previewRoutes, getRiderTask, invalidateRoutePlan };
