function permutations(values) {
  if (values.length < 2) {
    return [values];
  }

  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)])
      .map((permutation) => [value, ...permutation])
  );
}

function createRoute(orderIndexes, orders, distanceKm, pricing, maxTravelMinutes) {
  const totalBoxes = orderIndexes.reduce((total, index) => total + orders[index].totalBoxes, 0);
  const orderedIndexes = permutations(orderIndexes).reduce((best, permutation) => {
    const distance = permutation.reduce((total, orderIndex, index) => {
      const from = index === 0 ? 0 : permutation[index - 1] + 1;
      return total + distanceKm[from][orderIndex + 1];
    }, 0);

    return !best || distance < best.distanceKm
      ? { orderIndexes: permutation, distanceKm: distance }
      : best;
  }, null);

  const travelMinutes = (orderedIndexes.distanceKm / pricing.riderSpeedKmh) * 60;
  if (travelMinutes > maxTravelMinutes) {
    return null;
  }

  return {
    orderIndexes: orderedIndexes.orderIndexes,
    distanceKm: orderedIndexes.distanceKm,
    cost: pricing.riderFeePerTrip +
      orderedIndexes.distanceKm * pricing.riderCostPerKmPerBox * totalBoxes
  };
}

function createDistanceOrderSeeds(orders, riders, distanceKm, maxOrdersPerRider) {
  if (orders.length === 0 || riders.length === 0) {
    return [];
  }

  const groupCount = Math.min(
    riders.length,
    Math.ceil(orders.length / maxOrdersPerRider)
  );
  const nearToFar = orders
    .map((_, index) => index)
    .sort((first, second) =>
      distanceKm[0][first + 1] - distanceKm[0][second + 1] || first - second
    );
  const farToNear = [...nearToFar].reverse();

  const makeGroups = (indexes, distribution) => {
    if (distribution === 'round-robin') {
      return Array.from({ length: groupCount }, (_, groupIndex) =>
        indexes.filter((_, orderIndex) => orderIndex % groupCount === groupIndex)
      );
    }

    const groups = [];
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
    { method: 'far-to-near grouped', groups: makeGroups(farToNear, 'grouped') }
  ];
}

function optimizeRoutes(
  orders,
  riders,
  distanceKm,
  pricing,
  maxTravelMinutes = 60,
  seedCandidates = []
) {
  if (orders.length === 0) {
    return { routes: [], cost: 0 };
  }

  const routeCache = new Map();
  const routeFor = (indexes) => {
    const key = [...indexes].sort((a, b) => a - b).join(',');
    if (!routeCache.has(key)) {
      routeCache.set(key, createRoute(indexes, orders, distanceKm, pricing, maxTravelMinutes));
    }
    return routeCache.get(key);
  };
  const score = (groups) => {
    const routes = groups.map(routeFor);
    if (routes.some((route) => !route)) {
      return null;
    }
    return {
      routes,
      cost: routes.reduce((total, route) => total + route.cost, 0)
    };
  };

  const initialize = (orderIndexes) => {
    let groups = orderIndexes.map((index) => [index]);
    let current = score(groups);
    if (!current) {
      return null;
    }

    while (groups.length > 0) {
      let bestMerge = null;
      for (let first = 0; first < groups.length; first += 1) {
        for (let second = first + 1; second < groups.length; second += 1) {
          if (groups[first].length + groups[second].length > pricing.maxOrdersPerRider) {
            continue;
          }

          const merged = [...groups[first], ...groups[second]];
          const mergedRoute = routeFor(merged);
          if (!mergedRoute) {
            continue;
          }

          const saving = current.routes[first].cost + current.routes[second].cost - mergedRoute.cost;
          const mustReduceRiderCount = groups.length > riders.length;
          if (
            (mustReduceRiderCount || saving > 0.000001) &&
            (
              !bestMerge ||
              saving > bestMerge.saving + 0.000001 ||
              (
                Math.abs(saving - bestMerge.saving) <= 0.000001 &&
                merged.length > bestMerge.merged.length
              )
            )
          ) {
            bestMerge = { first, second, merged, saving };
          }
        }
      }

      if (!bestMerge) {
        return groups.length <= riders.length ? current : null;
      }

      groups = groups
        .filter((_, index) => index !== bestMerge.first && index !== bestMerge.second)
        .concat([bestMerge.merged]);
      current = score(groups);
    }

    return current;
  };

  const improve = (initialGroups) => {
    let groups = initialGroups.map((route) => [...route]);
    let current = score(groups);
    if (!current) {
      return null;
    }

    for (let iteration = 0; iteration < orders.length * orders.length * 2; iteration += 1) {
      let best = null;
      const consider = (candidateGroups) => {
        const candidate = score(candidateGroups);
        if (candidate && candidate.cost < current.cost - 0.000001 &&
          (!best || candidate.cost < best.score.cost)) {
          best = { groups: candidateGroups, score: candidate };
        }
      };

      for (let first = 0; first < groups.length; first += 1) {
        for (let second = first + 1; second < groups.length; second += 1) {
          if (groups[first].length + groups[second].length <= pricing.maxOrdersPerRider) {
            consider(groups
              .filter((_, index) => index !== first && index !== second)
              .concat([[...groups[first], ...groups[second]]]));
          }

          for (let firstOrder = 0; firstOrder < groups[first].length; firstOrder += 1) {
            for (let secondOrder = 0; secondOrder < groups[second].length; secondOrder += 1) {
              const firstGroup = [...groups[first]];
              const secondGroup = [...groups[second]];
              [firstGroup[firstOrder], secondGroup[secondOrder]] =
                [secondGroup[secondOrder], firstGroup[firstOrder]];
              const candidateGroups = groups.map((group, index) =>
                index === first ? firstGroup : index === second ? secondGroup : group
              );
              consider(candidateGroups);
            }

            if (groups[second].length < pricing.maxOrdersPerRider) {
              const from = [...groups[first]];
              const [moved] = from.splice(firstOrder, 1);
              const to = [...groups[second], moved];
              consider(groups
                .filter((_, index) => index !== first && index !== second)
                .concat(from.length ? [from, to] : [to]));
            }
          }
        }

        if (groups.length < riders.length && groups[first].length > 1) {
          for (let orderIndex = 0; orderIndex < groups[first].length; orderIndex += 1) {
            const remaining = [...groups[first]];
            const [moved] = remaining.splice(orderIndex, 1);
            consider(groups
              .filter((_, index) => index !== first)
              .concat([remaining, [moved]]));
          }
        }
      }

      if (!best) {
        break;
      }
      groups = best.groups;
      current = best.score;
    }

    return current;
  };

  const orderIndexes = orders.map((_, index) => index);
  const seeds = [
    orderIndexes,
    [...orderIndexes].reverse(),
    [...orderIndexes].sort((a, b) => orders[a].totalBoxes - orders[b].totalBoxes),
    [...orderIndexes].sort((a, b) => orders[b].totalBoxes - orders[a].totalBoxes)
  ];
  let best = null;
  const bestByMethod = new Map();
  const considerCandidate = (method, candidate) => {
    if (!candidate) {
      return;
    }

    const existing = bestByMethod.get(method);
    if (!existing || candidate.cost < existing.cost) {
      bestByMethod.set(method, candidate);
    }
    if (!best || candidate.cost < best.cost) {
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
      groups.some((group) => group.length === 0 || group.length > pricing.maxOrdersPerRider)
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
    return { error: 'ไม่สามารถจัดออเดอร์ให้ทุกเส้นทางถึงภายใน 12:30 น. ด้วยจำนวนไรเดอร์ที่พร้อมได้' };
  }

  return {
    cost: best.cost,
    method: best.method,
    comparisons: [...bestByMethod].map(([method, candidate]) => ({
      method,
      distanceKm: Number(candidate.routes.reduce((total, route) => total + route.distanceKm, 0).toFixed(2)),
      deliveryCost: Number(candidate.cost.toFixed(2))
    })),
    solutions: [...bestByMethod].map(([method, candidate]) => ({
      method,
      routes: candidate.routes.map((route) => ({
        orderIndexes: [...route.orderIndexes]
      }))
    })),
    routes: best.routes.map((route, index) => ({
      rider: riders[index],
      orders: route.orderIndexes.map((orderIndex) => orders[orderIndex]),
      plannedDistanceKm: route.distanceKm
    }))
  };
}

module.exports = { createDistanceOrderSeeds, optimizeRoutes, permutations };
