import type { RouteOptimizationMethod } from '../types';

export interface OptimizerOrder {
  id: number;
  totalBoxes: number;
}

export interface OptimizerRider {
  id: number;
}

export interface OptimizerPricing {
  riderFeePerTrip: number;
  riderCostPerKmPerBox: number;
  riderSpeedKmh: number;
  maxOrdersPerRider: number;
}

export interface OptimizedRoute {
  orderIndexes: number[];
  distanceKm: number;
  cost: number;
  totalBoxes: number;
}

interface ScoredPlan {
  routes: OptimizedRoute[];
  cost: number;
  fairnessPenalty: number;
}

export interface DistanceOrderSeed {
  method: RouteOptimizationMethod;
  groups: number[][];
}

export interface OptimizeResult {
  cost: number;
  method: RouteOptimizationMethod;
  comparisons: Array<{
    method: RouteOptimizationMethod;
    distanceKm: number;
    deliveryCost: number;
  }>;
  solutions: Array<{
    method: RouteOptimizationMethod;
    routes: Array<{ orderIndexes: number[] }>;
  }>;
  routes: Array<{
    rider: OptimizerRider;
    orders: OptimizerOrder[];
    plannedDistanceKm: number;
  }>;
  error?: string;
}

function fixedRiderForGroup(
  indexes: number[],
  fixedRiderByOrder: ReadonlyMap<number, number>,
): number | null | undefined {
  const fixedRiders = new Set(
    indexes
      .map((index) => fixedRiderByOrder.get(index))
      .filter((riderId): riderId is number => riderId !== undefined),
  );
  if (fixedRiders.size > 1) {
    return undefined;
  }
  return fixedRiders.values().next().value ?? null;
}

function routeRiderAssignments(
  groups: number[][],
  riders: OptimizerRider[],
  fixedRiderByOrder: ReadonlyMap<number, number>,
): number[] | null {
  const assignments = Array<number>(groups.length).fill(0);
  const usedRiders = new Set<number>();
  const automaticRoutes: number[] = [];

  for (let routeIndex = 0; routeIndex < groups.length; routeIndex += 1) {
    const fixedRider = fixedRiderForGroup(groups[routeIndex], fixedRiderByOrder);
    if (fixedRider === undefined) {
      return null;
    }
    if (fixedRider === null) {
      automaticRoutes.push(routeIndex);
      continue;
    }
    if (!riders.some((rider) => rider.id === fixedRider) || usedRiders.has(fixedRider)) {
      return null;
    }
    assignments[routeIndex] = fixedRider;
    usedRiders.add(fixedRider);
  }

  const availableRiders = riders
    .map((rider) => rider.id)
    .filter((riderId) => !usedRiders.has(riderId))
    .sort((first, second) => first - second);
  if (automaticRoutes.length > availableRiders.length) {
    return null;
  }

  automaticRoutes.forEach((routeIndex, index) => {
    assignments[routeIndex] = availableRiders[index];
  });
  return assignments;
}

function betterPlan(candidate: ScoredPlan, current: ScoredPlan): boolean {
  if (candidate.cost < current.cost - 0.000001) {
    return true;
  }
  return (
    Math.abs(candidate.cost - current.cost) <= 0.000001 &&
    candidate.fairnessPenalty < current.fairnessPenalty - 0.000001
  );
}

export function permutations<T>(values: T[]): T[][] {
  if (values.length < 2) {
    return [values];
  }

  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map(
      (permutation) => [value, ...permutation],
    ),
  );
}

function createRoute(
  orderIndexes: number[],
  orders: OptimizerOrder[],
  distanceKm: number[][],
  pricing: OptimizerPricing,
  maxTravelMinutes: number,
): OptimizedRoute | null {
  if (orderIndexes.length === 0) {
    return null;
  }

  const totalBoxes = orderIndexes.reduce(
    (total, index) => total + orders[index].totalBoxes,
    0,
  );

  let bestPermutation: number[] | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const permutation of permutations(orderIndexes)) {
    let distance = 0;
    permutation.forEach((orderIndex, index) => {
      const from = index === 0 ? 0 : permutation[index - 1] + 1;
      distance += distanceKm[from][orderIndex + 1];
    });
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPermutation = permutation;
    }
  }

  if (!bestPermutation) {
    return null;
  }

  const travelMinutes = (bestDistance / pricing.riderSpeedKmh) * 60;
  if (travelMinutes > maxTravelMinutes) {
    return null;
  }

  return {
    orderIndexes: bestPermutation,
    distanceKm: bestDistance,
    cost:
      pricing.riderFeePerTrip +
      bestDistance * pricing.riderCostPerKmPerBox * totalBoxes,
    totalBoxes,
  };
}

/**
 * ให้ความสำคัญกับค่าส่งเป็นหลัก แล้วจึงค่อย ๆ ปรับให้ภาระงานแต่ละคนใกล้กัน
 * (โจทย์ระบุปัญหาไรเดอร์แบ่งงานไม่เป็นธรรม)
 */
function fairnessPenalty(routes: OptimizedRoute[]): number {
  if (routes.length === 0) {
    return 0;
  }
  const orderCounts = routes.map((route) => route.orderIndexes.length);
  const boxCounts = routes.map((route) => route.totalBoxes);
  const orderSpread = Math.max(...orderCounts) - Math.min(...orderCounts);
  const boxSpread = Math.max(...boxCounts) - Math.min(...boxCounts);
  return orderSpread * 0.25 + boxSpread * 0.05;
}

export function createDistanceOrderSeeds(
  orders: OptimizerOrder[],
  riders: OptimizerRider[],
  distanceKm: number[][],
  maxOrdersPerRider: number,
): DistanceOrderSeed[] {
  if (orders.length === 0 || riders.length === 0) {
    return [];
  }

  const groupCount = Math.min(
    riders.length,
    Math.ceil(orders.length / maxOrdersPerRider),
  );
  const nearToFar = orders
    .map((_, index) => index)
    .sort(
      (first, second) =>
        distanceKm[0][first + 1] - distanceKm[0][second + 1] || first - second,
    );
  const farToNear = [...nearToFar].reverse();

  const makeGroups = (indexes: number[], distribution: 'round-robin' | 'grouped') => {
    if (distribution === 'round-robin') {
      return Array.from({ length: groupCount }, (_, groupIndex) =>
        indexes.filter((_, orderIndex) => orderIndex % groupCount === groupIndex),
      );
    }

    const groups: number[][] = [];
    const baseSize = Math.floor(indexes.length / groupCount);
    const extraOrders = indexes.length % groupCount;
    let offset = 0;
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
      const size = baseSize + (groupIndex < extraOrders ? 1 : 0);
      groups.push(indexes.slice(offset, offset + size));
      offset += size;
    }
    return groups;
  };

  return [
    { method: 'near-to-far round-robin', groups: makeGroups(nearToFar, 'round-robin') },
    { method: 'far-to-near round-robin', groups: makeGroups(farToNear, 'round-robin') },
    { method: 'near-to-far grouped', groups: makeGroups(nearToFar, 'grouped') },
    { method: 'far-to-near grouped', groups: makeGroups(farToNear, 'grouped') },
  ];
}

export function optimizeRoutes(
  orders: OptimizerOrder[],
  riders: OptimizerRider[],
  distanceKm: number[][],
  pricing: OptimizerPricing,
  maxTravelMinutes = 60,
  seedCandidates: DistanceOrderSeed[] = [],
  fixedRiderByOrder: ReadonlyMap<number, number> = new Map(),
): OptimizeResult {
  if (orders.length === 0) {
    return {
      cost: 0,
      method: 'local-search',
      comparisons: [],
      solutions: [],
      routes: [],
    };
  }

  if (riders.length === 0) {
    return {
      cost: 0,
      method: 'local-search',
      comparisons: [],
      solutions: [],
      routes: [],
      error: 'ไม่มีไรเดอร์ที่พร้อมรับงานในขณะนี้',
    };
  }

  const routeCache = new Map<string, OptimizedRoute | null>();
  const routeFor = (indexes: number[]): OptimizedRoute | null => {
    const key = [...indexes].sort((a, b) => a - b).join(',');
    if (!routeCache.has(key)) {
      routeCache.set(
        key,
        createRoute(indexes, orders, distanceKm, pricing, maxTravelMinutes),
      );
    }
    return routeCache.get(key) ?? null;
  };

  const score = (groups: number[][]): ScoredPlan | null => {
    const fixedGroups = groups.map((group) => fixedRiderForGroup(group, fixedRiderByOrder));
    if (fixedGroups.some((riderId) => riderId === undefined)) {
      return null;
    }
    const assignedRiders = fixedGroups.filter((riderId): riderId is number => riderId !== null);
    if (
      assignedRiders.some((riderId) => !riders.some((rider) => rider.id === riderId)) ||
      new Set(assignedRiders).size !== assignedRiders.length
    ) {
      return null;
    }
    const routes = groups.map(routeFor);
    if (routes.some((route) => !route)) {
      return null;
    }
    const validRoutes = routes as OptimizedRoute[];
    const cost = validRoutes.reduce((total, route) => total + route.cost, 0);
    const penalty = fairnessPenalty(validRoutes);
    return {
      routes: validRoutes,
      cost,
      fairnessPenalty: penalty,
    };
  };

  const initialize = (orderIndexes: number[]): ScoredPlan | null => {
    const pinnedGroups = new Map<number, number[]>();
    let groups: number[][] = [];
    for (const index of orderIndexes) {
      const fixedRiderId = fixedRiderByOrder.get(index);
      if (fixedRiderId === undefined) {
        groups.push([index]);
      } else {
        const group = pinnedGroups.get(fixedRiderId) ?? [];
        group.push(index);
        pinnedGroups.set(fixedRiderId, group);
      }
    }
    groups.unshift(...pinnedGroups.values());
    let current = score(groups);
    if (!current) {
      return null;
    }

    while (groups.length > 0) {
      let bestMerge: {
        first: number;
        second: number;
        merged: number[];
        saving: number;
      } | null = null;

      for (let first = 0; first < groups.length; first += 1) {
        for (let second = first + 1; second < groups.length; second += 1) {
          if (
            groups[first].length + groups[second].length >
            pricing.maxOrdersPerRider
          ) {
            continue;
          }

          const merged = [...groups[first], ...groups[second]];
          const mergedRoute = routeFor(merged);
          if (!mergedRoute) {
            continue;
          }

          const saving =
            current.routes[first].cost +
            current.routes[second].cost -
            mergedRoute.cost;
          const candidateGroups = groups
            .filter((_, index) => index !== first && index !== second)
            .concat([merged]);
          const candidate = score(candidateGroups);
          if (!candidate) {
            continue;
          }

          const mustReduceRiderCount = groups.length > riders.length;
          if (
            (mustReduceRiderCount || saving > 0.000001) &&
            (!bestMerge ||
              saving > bestMerge.saving + 0.000001 ||
              (Math.abs(saving - bestMerge.saving) <= 0.000001 &&
                merged.length > bestMerge.merged.length))
          ) {
            bestMerge = {
              first,
              second,
              merged,
              saving,
            };
          }
        }
      }

      if (!bestMerge) {
        return groups.length <= riders.length ? current : null;
      }

      groups = groups
        .filter(
          (_, index) => index !== bestMerge!.first && index !== bestMerge!.second,
        )
        .concat([bestMerge.merged]);
      const next = score(groups);
      if (!next) {
        return null;
      }
      current = next;
    }

    return current;
  };

  const improve = (initialGroups: number[][]): ScoredPlan | null => {
    let groups = initialGroups.map((route) => [...route]);
    const initial = score(groups);
    if (!initial) {
      return null;
    }
    let current: ScoredPlan = initial;
    for (
      let iteration = 0;
      iteration < orders.length * orders.length * 2;
      iteration += 1
    ) {
      const best: { value: { groups: number[][]; score: ScoredPlan } | null } = {
        value: null,
      };
      const consider = (candidateGroups: number[][]) => {
        const candidate = score(candidateGroups);
        if (
          candidate &&
          betterPlan(candidate, current) &&
          (!best.value || betterPlan(candidate, best.value.score))
        ) {
          best.value = { groups: candidateGroups, score: candidate };
        }
      };

      for (let first = 0; first < groups.length; first += 1) {
        for (let second = first + 1; second < groups.length; second += 1) {
          if (
            groups[first].length + groups[second].length <=
            pricing.maxOrdersPerRider
          ) {
            consider(
              groups
                .filter((_, index) => index !== first && index !== second)
                .concat([[...groups[first], ...groups[second]]]),
            );
          }

          for (let firstOrder = 0; firstOrder < groups[first].length; firstOrder += 1) {
            for (
              let secondOrder = 0;
              secondOrder < groups[second].length;
              secondOrder += 1
            ) {
              const firstGroup = [...groups[first]];
              const secondGroup = [...groups[second]];
              [firstGroup[firstOrder], secondGroup[secondOrder]] = [
                secondGroup[secondOrder],
                firstGroup[firstOrder],
              ];
              consider(
                groups.map((group, index) =>
                  index === first
                    ? firstGroup
                    : index === second
                      ? secondGroup
                      : group,
                ),
              );
            }

            if (groups[second].length < pricing.maxOrdersPerRider) {
              const from = [...groups[first]];
              const [moved] = from.splice(firstOrder, 1);
              const to = [...groups[second], moved];
              consider(
                groups
                  .filter((_, index) => index !== first && index !== second)
                  .concat(from.length ? [from, to] : [to]),
              );
            }
          }
        }

        if (groups.length < riders.length && groups[first].length > 1) {
          for (
            let orderIndex = 0;
            orderIndex < groups[first].length;
            orderIndex += 1
          ) {
            const remaining = [...groups[first]];
            const [moved] = remaining.splice(orderIndex, 1);
            consider(
              groups
                .filter((_, index) => index !== first)
                .concat([remaining, [moved]]),
            );
          }
        }
      }

      if (!best.value) {
        break;
      }
      groups = best.value.groups;
      current = best.value.score;
    }

    return current;
  };

  const orderIndexes = orders.map((_, index) => index);
  const seeds = [
    orderIndexes,
    [...orderIndexes].reverse(),
    [...orderIndexes].sort(
      (a, b) => orders[a].totalBoxes - orders[b].totalBoxes,
    ),
    [...orderIndexes].sort(
      (a, b) => orders[b].totalBoxes - orders[a].totalBoxes,
    ),
  ];

  let best: (ScoredPlan & { method: RouteOptimizationMethod }) | null = null;
  const bestByMethod = new Map<RouteOptimizationMethod, ScoredPlan>();
  const considerCandidate = (
    method: RouteOptimizationMethod,
    candidate: ScoredPlan | null,
  ) => {
    if (!candidate) {
      return;
    }
    const existing = bestByMethod.get(method);
    if (!existing || betterPlan(candidate, existing)) {
      bestByMethod.set(method, candidate);
    }
    if (!best || betterPlan(candidate, best)) {
      best = { ...candidate, method };
    }
  };

  for (const seed of seeds) {
    const initial = initialize(seed);
    if (!initial) {
      continue;
    }
    const candidate = improve(initial.routes.map((route) => route.orderIndexes));
    considerCandidate('local-search', candidate);
  }

  for (const seedCandidate of seedCandidates) {
    const { groups, method } = seedCandidate;
    if (
      groups.length === 0 ||
      groups.length > riders.length ||
      groups.some(
        (group) =>
          group.length === 0 || group.length > pricing.maxOrdersPerRider,
      )
    ) {
      continue;
    }
    const initial = score(groups);
    if (!initial) {
      continue;
    }
    const candidate = improve(groups);
    considerCandidate(method, candidate);
  }

  if (!best) {
    return {
      cost: 0,
      method: 'local-search',
      comparisons: [],
      solutions: [],
      routes: [],
      error:
        'ไม่สามารถจัดออเดอร์ให้ทุกเส้นทางถึงภายใน 12:30 น. ด้วยจำนวนไรเดอร์ที่พร้อมได้ กรุณาเพิ่มไรเดอร์หรือลดจำนวนออเดอร์',
    };
  }

  const selected = best as ScoredPlan & { method: RouteOptimizationMethod };
  const riderAssignments = routeRiderAssignments(
    selected.routes.map((route) => route.orderIndexes),
    riders,
    fixedRiderByOrder,
  );
  if (!riderAssignments) {
    return {
      cost: 0,
      method: 'local-search',
      comparisons: [],
      solutions: [],
      routes: [],
      error: 'ไม่สามารถจับคู่กลุ่มออเดอร์กับไรเดอร์ที่พร้อมได้',
    };
  }

  return {
    cost: selected.cost,
    method: selected.method,
    comparisons: [...bestByMethod].map(([method, candidate]) => ({
      method,
      distanceKm: Number(
        candidate.routes
          .reduce((total, route) => total + route.distanceKm, 0)
          .toFixed(2),
      ),
      deliveryCost: Number(candidate.cost.toFixed(2)),
    })),
    solutions: [...bestByMethod].map(([method, candidate]) => ({
      method,
      routes: candidate.routes.map((route) => ({
        orderIndexes: [...route.orderIndexes],
      })),
    })),
    routes: selected.routes.map((route, index) => ({
      rider: riders.find((rider) => rider.id === riderAssignments[index])!,
      orders: route.orderIndexes.map((orderIndex) => orders[orderIndex]),
      plannedDistanceKm: route.distanceKm,
    })),
  };
}
