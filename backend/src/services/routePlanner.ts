import { pricing, shop } from '../config/delivery';
import type { Store } from '../db/store';
import type {
  Customer,
  Location,
  Order,
  OrderView,
  Pricing,
  Rider,
  RiderRoute,
  RiderTask,
  RoutePlan,
  RouteStrategy,
  RouteTotals,
} from '../types';
import { conflict, notFound } from '../utils/errors';
import {
  haversineDistanceKm,
  requestOsrmRoute,
  requestOsrmTable,
} from './geo';
import type { RouteMetrics } from './geo';
import {
  createDistanceOrderSeeds,
  optimizeRoutes,
} from './routeOptimizer';

interface PlannerData {
  shop: Location;
  pricing: Pricing;
  customers: Customer[];
  orders: Order[];
  riders: Rider[];
}

interface RiderGroup {
  rider: Rider;
  orders: OrderView[];
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const todayInBangkok = (): string => dateFormatter.format(new Date());

function timeOfDayMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function deliveryWindowMinutes(): number {
  const departure = timeOfDayMinutes(pricing.departureTime);
  let deadline = timeOfDayMinutes(pricing.deadlineTime);
  if (deadline < departure) {
    deadline += 24 * 60;
  }
  return deadline - departure;
}

export async function loadPlannerData(store: Store): Promise<PlannerData> {
  const [customers, orders, riders] = await Promise.all([
    store.listCustomers(),
    store.listOrders(),
    store.listRiders(),
  ]);
  return { shop, pricing, customers, orders, riders };
}

function orderWithCustomer(order: Order, data: PlannerData): OrderView {
  const customer = data.customers.find((item) => item.id === order.customerId);
  const rider = order.riderId
    ? data.riders.find((item) => item.id === order.riderId)
    : undefined;
  return {
    ...order,
    customerName: customer?.name ?? 'ไม่พบข้อมูลลูกค้า',
    customerPhone: customer?.phone ?? '',
    riderName: rider?.name ?? null,
    riderJobCode: rider?.jobCode ?? null,
    pickupAddress: data.shop.address,
    deliveryAddress: customer?.address ?? '',
    address: customer?.address ?? '',
    latitude: customer?.latitude ?? data.shop.latitude,
    longitude: customer?.longitude ?? data.shop.longitude,
  };
}

function orderStops(group: RiderGroup): OrderView[] {
  const remaining = [...group.orders];

  const ordered: OrderView[] = [];
  let current: { latitude: number; longitude: number } = shop;
  while (remaining.length > 0) {
    let closestIndex = 0;
    for (let index = 1; index < remaining.length; index += 1) {
      if (
        haversineDistanceKm(current, remaining[index]) <
        haversineDistanceKm(current, remaining[closestIndex])
      ) {
        closestIndex = index;
      }
    }
    const [next] = remaining.splice(closestIndex, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

async function makeRoute(
  group: RiderGroup,
  orders: OrderView[],
  data: PlannerData,
  routeMetricsCache: Map<string, Promise<RouteMetrics>>,
): Promise<RiderRoute> {
  const cacheKey = orders.map((order) => order.id).join(',');
  if (!routeMetricsCache.has(cacheKey)) {
    routeMetricsCache.set(
      cacheKey,
      requestOsrmRoute([
        { latitude: data.shop.latitude, longitude: data.shop.longitude },
        ...orders.map(({ latitude, longitude }) => ({ latitude, longitude })),
      ]),
    );
  }
  const metrics = await routeMetricsCache.get(cacheKey)!;

  const stops = orders.map((order, index) => ({
    ...orderWithCustomer(order, data),
    riderId: group.rider.id,
    riderName: group.rider.name,
    riderJobCode: group.rider.jobCode,
    sequenceNumber: index + 1,
  }));

  const distance = metrics.distanceKm;
  const totalBoxes = stops.reduce((sum, stop) => sum + stop.totalBoxes, 0);
  const travelMinutes = Math.ceil((distance / pricing.riderSpeedKmh) * 60);
  const revenue = totalBoxes * pricing.salePricePerBox;
  const foodCost = totalBoxes * pricing.foodCostPerBox;
  const deliveryCost =
    stops.length > 0
      ? pricing.riderFeePerTrip +
        distance * pricing.riderCostPerKmPerBox * totalBoxes
      : 0;

  const departureMinutes = timeOfDayMinutes(pricing.departureTime);
  const arrivalMinutes = departureMinutes + travelMinutes;
  const arrivalClockMinutes = arrivalMinutes % (24 * 60);
  const arrivalHours = Math.floor(arrivalClockMinutes / 60);
  const arrivalMinute = arrivalClockMinutes % 60;

  return {
    rider: group.rider,
    stops,
    totalBoxes,
    geometry: metrics.geometry,
    distanceSource: metrics.source,
    distanceKm: Number(distance.toFixed(2)),
    travelMinutes,
    revenue: Number(revenue.toFixed(2)),
    foodCost: Number(foodCost.toFixed(2)),
    deliveryCost: Number(deliveryCost.toFixed(2)),
    profit: Number((revenue - foodCost - deliveryCost).toFixed(2)),
    estimatedArrival: `${String(arrivalHours).padStart(2, '0')}:${String(
      arrivalMinute,
    ).padStart(2, '0')}`,
    meetsDeadline: travelMinutes <= deliveryWindowMinutes(),
  };
}

function emptyTotals(): RouteTotals {
  return {
    totalBoxes: 0,
    distanceKm: 0,
    totalTravelMinutes: 0,
    revenue: 0,
    foodCost: 0,
    deliveryCost: 0,
    profit: 0,
    allRoutesMeetDeadline: true,
    budget: pricing.dailyDeliveryBudget,
    overBudget: false,
    targetProfit: pricing.targetProfit,
    belowTargetProfit: false,
  };
}

function sumTotals(routes: RiderRoute[]): RouteTotals {
  const totals = routes.reduce<RouteTotals>(
    (result, route) => ({
      ...result,
      totalBoxes: result.totalBoxes + route.totalBoxes,
      distanceKm: result.distanceKm + route.distanceKm,
      totalTravelMinutes: result.totalTravelMinutes + route.travelMinutes,
      revenue: result.revenue + route.revenue,
      foodCost: result.foodCost + route.foodCost,
      deliveryCost: result.deliveryCost + route.deliveryCost,
      profit: result.profit + route.profit,
      allRoutesMeetDeadline: result.allRoutesMeetDeadline && route.meetsDeadline,
    }),
    emptyTotals(),
  );

  totals.distanceKm = Number(totals.distanceKm.toFixed(2));
  totals.revenue = Number(totals.revenue.toFixed(2));
  totals.foodCost = Number(totals.foodCost.toFixed(2));
  totals.deliveryCost = Number(totals.deliveryCost.toFixed(2));
  totals.profit = Number(totals.profit.toFixed(2));
  totals.overBudget = totals.deliveryCost > pricing.dailyDeliveryBudget + 0.000001;
  totals.belowTargetProfit =
    totals.totalBoxes > 0 && totals.profit < pricing.targetProfit;
  return totals;
}

export async function computePlan(
  strategy: RouteStrategy,
  store: Store,
): Promise<RoutePlan> {
  const data = await loadPlannerData(store);
  const readyOrders = data.orders
    .filter((order) => order.status === 'ready' || order.status === 'delivering')
    .map((order) => orderWithCustomer(order, data));
  const availableRiders = data.riders.filter((rider) => rider.status === 'available');
  if (readyOrders.length > 0 && availableRiders.length === 0) {
    throw conflict('ไม่มีไรเดอร์ที่พร้อมรับงานในขณะนี้');
  }

  const pinnedRiderByOrder = new Map<number, number>();
  const pinnedCounts = new Map<number, number>();
  const riderById = new Map(availableRiders.map((rider) => [rider.id, rider]));
  readyOrders.forEach((order, index) => {
    const mustKeepRider = order.assignmentMode === 'manual' || order.status === 'delivering';
    if (!mustKeepRider) {
      return;
    }
    if (order.riderId === null) {
      throw conflict(
        `ออเดอร์ #${order.id} กำลังจัดส่งหรือกำหนดไรเดอร์เอง แต่ไม่มีไรเดอร์ที่เลือกไว้`,
      );
    }
    const rider = riderById.get(order.riderId);
    if (!rider) {
      throw conflict(`ไรเดอร์ของออเดอร์ #${order.id} ไม่พร้อมรับงานในขณะนี้`);
    }
    pinnedRiderByOrder.set(index, rider.id);
    const count = (pinnedCounts.get(rider.id) ?? 0) + 1;
    if (count > pricing.maxOrdersPerRider) {
      throw conflict(
        `ไรเดอร์ ${rider.name} มีออเดอร์ที่กำหนดไว้ ${count} รายการ เกินกำหนด ${pricing.maxOrdersPerRider} ออเดอร์ต่อคน`,
      );
    }
    pinnedCounts.set(rider.id, count);
  });

  const routeMetricsCache = new Map<string, Promise<RouteMetrics>>();
  let groups: RiderGroup[] = [];
  let optimizationSource: 'osrm' | 'haversine' | undefined;
  let optimizationMethod: RoutePlan['optimizationMethod'];
  let optimizationComparisons: RoutePlan['optimizationComparisons'];
  let optimizationComparisonMethod: RoutePlan['optimizationComparisonMethod'];

  if (readyOrders.length > 0 && strategy === 'alternative') {
    const table = await requestOsrmTable([
      data.shop,
      ...readyOrders,
    ].map(({ latitude, longitude }) => ({ latitude, longitude })));
    const optimizerOrders = readyOrders.map(({ id, totalBoxes }) => ({ id, totalBoxes }));
    const seedCandidates = createDistanceOrderSeeds(
      optimizerOrders,
      availableRiders,
      table.distanceKm,
      pricing.maxOrdersPerRider,
    );
    const optimized = optimizeRoutes(
      optimizerOrders,
      availableRiders,
      table.distanceKm,
      pricing,
      deliveryWindowMinutes(),
      seedCandidates,
      pinnedRiderByOrder,
    );
    if (optimized.error) {
      throw conflict(optimized.error);
    }

    const orderById = new Map(readyOrders.map((order) => [order.id, order]));
    groups = optimized.routes.map((route) => {
      const rider = riderById.get(route.rider.id);
      if (!rider) {
        throw conflict('ไม่พบไรเดอร์ที่ระบบจัดให้ กรุณาคำนวณใหม่');
      }
      return {
        rider,
        orders: route.orders.map((order) => {
          const found = orderById.get(order.id);
          if (!found) {
            throw conflict(`ไม่พบออเดอร์ #${order.id} ในแผน`);
          }
          return found;
        }),
      };
    });
    optimizationSource = table.source;
    optimizationMethod = optimized.method;
    optimizationComparisons = optimized.comparisons;
    optimizationComparisonMethod = 'table';
  } else if (readyOrders.length > 0) {
    const groupsByRider = new Map<number, RiderGroup>();
    for (const rider of availableRiders) {
      groupsByRider.set(rider.id, { rider, orders: [] });
    }
    readyOrders.forEach((order, index) => {
      const riderId = pinnedRiderByOrder.get(index);
      if (riderId === undefined) {
        return;
      }
      groupsByRider.get(riderId)!.orders.push(order);
    });

    const unassignedOrders = readyOrders
      .filter((_, index) => !pinnedRiderByOrder.has(index))
      .sort((first, second) =>
        haversineDistanceKm(data.shop, first) - haversineDistanceKm(data.shop, second) ||
        first.id - second.id,
      );
    for (const order of unassignedOrders) {
      const candidates = [...groupsByRider.values()]
        .filter((group) => group.orders.length < pricing.maxOrdersPerRider)
        .sort((first, second) =>
          first.orders.length - second.orders.length || first.rider.id - second.rider.id,
        );
      const group = candidates[0];
      if (!group) {
        throw conflict(
          `ออเดอร์พร้อมส่ง ${readyOrders.length} รายการ เกินความจุของไรเดอร์ที่พร้อมรับงาน`,
        );
      }
      group.orders.push(order);
    }
    groups = [...groupsByRider.values()]
      .filter((group) => group.orders.length > 0)
      .map((group) => ({ ...group, orders: orderStops(group) }));
  }

  const routes = await Promise.all(
    groups.map((group) => makeRoute(group, group.orders, data, routeMetricsCache)),
  );

  return {
    strategy,
    planDate: todayInBangkok(),
    publishedAt: new Date().toISOString(),
    shop: data.shop,
    pricing: data.pricing,
    ...(optimizationSource ? { optimizationSource } : {}),
    ...(optimizationMethod ? { optimizationMethod } : {}),
    ...(optimizationComparisons ? { optimizationComparisons } : {}),
    ...(optimizationComparisonMethod ? { optimizationComparisonMethod } : {}),
    totals: sumTotals(routes),
    routes,
  };
}

export async function publishPlan(
  strategy: RouteStrategy,
  store: Store,
): Promise<RoutePlan> {
  const plan = await computePlan(strategy, store);
  if (plan.routes.length === 0) {
    throw conflict('ไม่มีออเดอร์พร้อมจัดส่ง จึงยังเผยแพร่ใบงานไม่ได้');
  }
  if (!plan.totals.allRoutesMeetDeadline) {
    throw conflict('มีเส้นทางที่คาดว่าจะถึงหลัง 12:30 น. กรุณาปรับแผนก่อนเผยแพร่');
  }
  const assignments = plan.routes.flatMap((route) =>
    route.stops.map((stop) => ({ orderId: stop.id, riderId: route.rider.id })),
  );
  await store.saveRoutePlan(plan, assignments);
  return plan;
}

export async function getCurrentPlan(store: Store): Promise<RoutePlan> {
  const plan = await store.getRoutePlan();
  if (!plan) {
    throw notFound('ยังไม่มีแผนเส้นทางที่เผยแพร่ กรุณาให้เจ้าของร้านคำนวณและเผยแพร่แผนก่อน');
  }
  return plan;
}

export async function getRiderTask(
  jobCode: string,
  store: Store,
): Promise<RiderTask> {
  const rider = await store.getRiderByJobCode(jobCode.trim());
  if (!rider) {
    throw notFound('ไม่พบรหัสพนักงาน กรุณาตรวจสอบรหัสอีกครั้ง');
  }

  const plan = await store.getRoutePlan();
  if (!plan) {
    throw notFound('ยังไม่มีแผนเส้นทางที่เผยแพร่ กรุณาให้เจ้าของร้านเผยแพร่แผนก่อน');
  }

  const route = plan.routes.find((item) => item.rider.id === rider.id);
  if (!route) {
    throw notFound('วันนี้ยังไม่มีงานที่มอบหมายให้รหัสพนักงานนี้');
  }

  return {
    ...route,
    jobCode: rider.jobCode,
    rider,
    shop: plan.shop,
    planDate: plan.planDate,
    publishedAt: plan.publishedAt,
    isToday: plan.planDate === todayInBangkok(),
  };
}

export async function invalidatePlan(store: Store): Promise<void> {
  await store.clearRoutePlan();
}
