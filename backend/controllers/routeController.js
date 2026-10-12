const mockData = require('../data/mockData');

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

function orderWithCustomer(order) {
  const customer = mockData.customers.find((item) => item.id === order.customerId);
  return {
    ...order,
    customerName: customer ? customer.name : 'ไม่พบข้อมูลลูกค้า',
    address: customer ? customer.address : '',
    latitude: customer ? customer.latitude : mockData.shop.latitude,
    longitude: customer ? customer.longitude : mockData.shop.longitude
  };
}

function distributeOrders(orders, riders, strategy) {
  const groups = riders.map((rider) => ({ rider, orders: [] }));
  const sortedOrders = [...orders].sort((a, b) => {
    if (strategy === 'alternative') {
      return b.id - a.id;
    }
    return distanceKm(mockData.shop, a) - distanceKm(mockData.shop, b);
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
  let current = mockData.shop;
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

function makeRoute(group, strategy) {
  const stops = orderStops(group, strategy).map((order, index) => ({
    ...orderWithCustomer(order),
    sequenceNumber: index + 1
  }));

  let previous = mockData.shop;
  const distance = stops.reduce((sum, stop) => {
    const legDistance = distanceKm(previous, stop);
    previous = stop;
    return sum + legDistance;
  }, 0);
  const totalBoxes = stops.reduce((sum, stop) => sum + stop.totalBoxes, 0);
  const travelMinutes = (distance / mockData.pricing.riderSpeedKmh) * 60;
  const revenue = totalBoxes * mockData.pricing.salePricePerBox;
  const foodCost = totalBoxes * mockData.pricing.foodCostPerBox;
  const deliveryCost = stops.length > 0
    ? mockData.pricing.riderFeePerTrip +
      distance * mockData.pricing.riderCostPerKmPerBox * totalBoxes
    : 0;
  const arrival = new Date(`2026-10-12T${mockData.pricing.departureTime}:00`);
  arrival.setMinutes(arrival.getMinutes() + Math.ceil(travelMinutes));

  return {
    rider: group.rider,
    stops,
    totalBoxes,
    distanceKm: Number(distance.toFixed(2)),
    travelMinutes: Math.ceil(travelMinutes),
    revenue: Number(revenue.toFixed(2)),
    foodCost: Number(foodCost.toFixed(2)),
    deliveryCost: Number(deliveryCost.toFixed(2)),
    profit: Number((revenue - foodCost - deliveryCost).toFixed(2)),
    estimatedArrival: `${String(arrival.getHours()).padStart(2, '0')}:${String(arrival.getMinutes()).padStart(2, '0')}`,
    meetsDeadline: arrival.getHours() < 12 || (arrival.getHours() === 12 && arrival.getMinutes() <= 30)
  };
}

function buildPreview(strategy) {
  const readyOrders = mockData.orders
    .filter((order) => order.status === 'ready')
    .map(orderWithCustomer);
  const availableRiders = mockData.riders.filter((rider) => rider.status === 'available');
  const capacity = availableRiders.length * mockData.pricing.maxOrdersPerRider;

  if (readyOrders.length > 0 && availableRiders.length === 0) {
    return { error: 'ไม่มีไรเดอร์ที่พร้อมรับงานในขณะนี้', status: 409 };
  }
  if (readyOrders.length > capacity) {
    return {
      error: `มีออเดอร์พร้อมส่ง ${readyOrders.length} รายการ แต่ไรเดอร์ที่พร้อมรับงานรองรับได้ ${capacity} รายการ`,
      status: 409
    };
  }

  const groups = readyOrders.length > 0
    ? distributeOrders(readyOrders, availableRiders, strategy)
    : [];
  const routes = groups.filter((group) => group.orders.length > 0).map((group) => makeRoute(group, strategy));
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
      shop: mockData.shop,
      pricing: mockData.pricing,
      totals,
      routes
    }
  };
}

function previewRoutes(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const strategy = body.strategy === 'alternative' ? 'alternative' : 'nearest';
  const result = buildPreview(strategy);
  if (result.error) {
    return res.status(result.status).json({ message: result.error });
  }
  mockData.currentRoutePlan = result.data;
  return res.json({ success: true, data: result.data });
}

function getRiderTask(req, res) {
  const rider = mockData.riders.find((item) => item.jobCode.toLowerCase() === req.params.jobCode.toLowerCase());
  if (!rider) {
    return res.status(404).json({ message: 'ไม่พบเลขใบงาน กรุณาตรวจสอบรหัสอีกครั้ง' });
  }

  let routePlan = mockData.currentRoutePlan;
  if (!routePlan) {
    const result = buildPreview('nearest');
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
}

module.exports = { previewRoutes, getRiderTask };
