import type { Request, Response } from 'express';
import { store } from '../db';
import { pricing, shop } from '../config/delivery';
import type { Customer, Order, OrderStatus, OrderView, Rider, RiderAssignmentMode } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, conflict, notFound } from '../utils/errors';
import { invalidatePlan } from '../services/routePlanner';
import { asEnum, asInt } from '../utils/validate';

const allowedStatuses: readonly OrderStatus[] = [
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'cancelled',
];

const activeStatuses: readonly OrderStatus[] = [
  'pending',
  'preparing',
  'ready',
  'delivering',
];

function serializeOrder(order: Order, customers: Customer[], riders: Rider[]): OrderView {
  const customer = customers.find((item) => item.id === order.customerId);
  const rider = order.riderId
    ? riders.find((item) => item.id === order.riderId)
    : undefined;
  return {
    ...order,
    customerName: customer?.name ?? 'ไม่พบข้อมูลลูกค้า',
    customerPhone: customer?.phone ?? '',
    riderName: rider?.name ?? null,
    riderJobCode: rider?.jobCode ?? null,
    pickupAddress: shop.address,
    deliveryAddress: customer?.address ?? '',
    address: customer?.address ?? '',
    latitude: customer?.latitude ?? shop.latitude,
    longitude: customer?.longitude ?? shop.longitude,
  };
}

async function loadCustomersAndRiders(): Promise<[Customer[], Rider[]]> {
  return Promise.all([store.listCustomers(), store.listRiders()]);
}

export const getOrders = asyncHandler(async (_req: Request, res: Response) => {
  const [orders, [customers, riders]] = await Promise.all([
    store.listOrders(),
    loadCustomersAndRiders(),
  ]);
  res.json({
    success: true,
    data: orders.map((order) => serializeOrder(order, customers, riders)),
  });
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const customerId = asInt(body.customerId, 'ลูกค้า', 1, Number.MAX_SAFE_INTEGER);
  const riderId = body.riderId === undefined || body.riderId === null
    ? null
    : asInt(body.riderId, 'ไรเดอร์', 1, Number.MAX_SAFE_INTEGER);
  const totalBoxes = asInt(
    body.totalBoxes,
    'จำนวนกล่อง',
    1,
    pricing.maxBoxesPerOrder,
  );

  const customer = await store.getCustomer(customerId);
  if (!customer) {
    throw badRequest('ไม่พบข้อมูลลูกค้าที่เลือก');
  }

  const rider = riderId === null ? null : await store.getRider(riderId);
  if (riderId !== null && !rider) {
    throw badRequest('ไม่พบไรเดอร์ที่เลือก');
  }
  if (rider && rider.status !== 'available') {
    throw conflict(`ไรเดอร์ ${rider.name} ไม่พร้อมรับงานในขณะนี้`);
  }

  const customerActiveOrders = await store.countActiveOrders({ customerId });
  if (customerActiveOrders > 0) {
    throw conflict(
      `ลูกค้า ${customer.name} ยังมีออเดอร์ที่จัดส่งไม่เสร็จ ต้องรอให้จัดส่งเสร็จหรือยกเลิกก่อนจึงจะสั่งรอบใหม่ได้`,
    );
  }

  if (riderId !== null && rider) {
    const riderActiveOrders = await store.countActiveOrders({ riderId, pinnedRiderOnly: true });
    if (riderActiveOrders >= pricing.maxOrdersPerRider) {
      throw conflict(
        `ไรเดอร์ ${rider.name} มีออเดอร์ที่กำหนดให้แล้วครบ ${pricing.maxOrdersPerRider} ออเดอร์ กรุณาเลือกอัตโนมัติหรือไรเดอร์คนอื่น`,
      );
    }
  }

  const order = await store.createOrder(customerId, totalBoxes, riderId);
  await invalidatePlan(store);
  res.status(201).json({
    success: true,
    data: serializeOrder(order, [customer], rider ? [rider] : []),
  });
});

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const order = Number.isInteger(id) && id > 0 ? await store.getOrder(id) : null;
  if (!order) {
    throw notFound('ไม่พบออเดอร์ที่ต้องการแก้ไข');
  }

  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const update: {
    customerId?: number;
    riderId?: number | null;
    assignmentMode?: RiderAssignmentMode;
    totalBoxes?: number;
    status?: OrderStatus;
  } = {};

  let selectedCustomer: Customer | undefined;
  if (body.customerId !== undefined) {
    const customerId = asInt(body.customerId, 'ลูกค้า', 1, Number.MAX_SAFE_INTEGER);
    selectedCustomer = (await store.getCustomer(customerId)) ?? undefined;
    if (!selectedCustomer) {
      throw badRequest('ไม่พบข้อมูลลูกค้าที่เลือก');
    }
    update.customerId = customerId;
  }

  let selectedRider: Rider | undefined;
  if (body.riderId !== undefined) {
    if (body.riderId === null) {
      update.riderId = null;
      update.assignmentMode = 'auto';
    } else {
      const riderId = asInt(body.riderId, 'ไรเดอร์', 1, Number.MAX_SAFE_INTEGER);
      selectedRider = (await store.getRider(riderId)) ?? undefined;
      if (!selectedRider) {
        throw badRequest('ไม่พบไรเดอร์ที่เลือก');
      }
      update.riderId = riderId;
      update.assignmentMode = 'manual';
    }
  }

  if (body.totalBoxes !== undefined) {
    update.totalBoxes = asInt(
      body.totalBoxes,
      'จำนวนกล่อง',
      1,
      pricing.maxBoxesPerOrder,
    );
  }

  if (body.status !== undefined) {
    update.status = asEnum(body.status, allowedStatuses, 'สถานะออเดอร์');
  }

  const finalCustomerId = update.customerId ?? order.customerId;
  const finalRiderId = update.riderId !== undefined ? update.riderId : order.riderId;
  const finalStatus = update.status ?? order.status;

  if (activeStatuses.includes(finalStatus)) {
    const customer = selectedCustomer ?? (await store.getCustomer(finalCustomerId));
    if (!customer) {
      throw badRequest('ไม่พบข้อมูลลูกค้าที่เลือก');
    }
    const customerActiveOrders = await store.countActiveOrders({
      customerId: finalCustomerId,
      excludeOrderId: id,
    });
    if (customerActiveOrders > 0) {
      throw conflict(
        `ลูกค้า ${customer.name} ยังมีออเดอร์ที่จัดส่งไม่เสร็จ ต้องรอให้จัดส่งเสร็จหรือยกเลิกก่อนจึงจะสั่งรอบใหม่ได้`,
      );
    }

    if (finalStatus === 'delivering' && finalRiderId === null) {
      throw badRequest('ก่อนเริ่มจัดส่ง กรุณาเผยแพร่แผนเพื่อกำหนดไรเดอร์ให้ออเดอร์อัตโนมัติก่อน');
    }
    if (finalRiderId !== null) {
      const rider = selectedRider ?? (await store.getRider(finalRiderId));
      if (!rider) {
        throw badRequest('ไม่พบไรเดอร์ที่เลือก');
      }
      if (rider.status !== 'available') {
        throw conflict(`ไรเดอร์ ${rider.name} ไม่พร้อมรับงานในขณะนี้`);
      }
      const riderActiveOrders = await store.countActiveOrders({
        riderId: finalRiderId,
        excludeOrderId: id,
        pinnedRiderOnly: true,
      });
      if (riderActiveOrders >= pricing.maxOrdersPerRider) {
        throw conflict(
          `ไรเดอร์ ${rider.name} มีออเดอร์ที่กำหนดให้แล้วครบ ${pricing.maxOrdersPerRider} ออเดอร์ กรุณาเลือกอัตโนมัติหรือไรเดอร์คนอื่น`,
        );
      }
    }
  }

  const updated = await store.updateOrder(id, update);
  if (!updated) {
    throw notFound('ไม่พบออเดอร์ที่ต้องการแก้ไข');
  }

  // Changing status from ready to delivering must not clear the published plan,
  // otherwise the rider loses the job just as the delivery starts.
  const statusChanged = update.status !== undefined && update.status !== order.status;
  const statusNeedsReplan =
    statusChanged &&
    (update.status === 'ready' ||
      (order.status === 'ready' && update.status !== 'delivering') ||
      (order.status === 'delivering' && update.status !== 'delivered'));
  const routeChanged =
    update.customerId !== undefined ||
    update.riderId !== undefined ||
    update.totalBoxes !== undefined;
  if (routeChanged || statusNeedsReplan) {
    await invalidatePlan(store);
  }

  const [customers, riders] = await loadCustomersAndRiders();
  res.json({ success: true, data: serializeOrder(updated, customers, riders) });
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw notFound('ไม่พบออเดอร์ที่ต้องการลบ');
  }
  const order = await store.deleteOrder(id);
  if (!order) {
    throw notFound('ไม่พบออเดอร์ที่ต้องการลบ');
  }
  await invalidatePlan(store);

  const [customers, riders] = await loadCustomersAndRiders();
  res.json({ success: true, data: serializeOrder(order, customers, riders) });
});
