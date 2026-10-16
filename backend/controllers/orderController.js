const { db } = require('../config/firebase');
const { pricing, shop } = require('../config/delivery');
const asyncHandler = require('../utils/asyncHandler');
const { invalidateRoutePlan } = require('./routeController');

const orders = db.collection('orders');
const customers = db.collection('customers');
const counters = db.collection('_metadata').doc('counters');
const allowedStatuses = new Set(['pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']);

function sortById(snapshot) {
  return snapshot.docs
    .map((document) => document.data())
    .sort((a, b) => a.id - b.id);
}

async function serializeOrder(order, customerRecords) {
  let customer = customerRecords?.find((item) => item.id === order.customerId);
  if (!customer) {
    const snapshot = await customers.doc(String(order.customerId)).get();
    customer = snapshot.exists ? snapshot.data() : null;
  }

  return {
    ...order,
    customerName: customer ? customer.name : 'ไม่พบข้อมูลลูกค้า',
    customerPhone: customer ? customer.phone : '',
    pickupAddress: shop.address,
    deliveryAddress: customer ? customer.address : '',
    latitude: customer ? customer.latitude : null,
    longitude: customer ? customer.longitude : null
  };
}

const getOrders = asyncHandler(async (req, res) => {
  const [orderSnapshot, customerSnapshot] = await Promise.all([orders.get(), customers.get()]);
  const customerRecords = sortById(customerSnapshot);
  const data = await Promise.all(sortById(orderSnapshot).map((order) => serializeOrder(order, customerRecords)));
  res.json({ success: true, data });
});

const createOrder = asyncHandler(async (req, res) => {
  const { customerId, totalBoxes } = req.body && typeof req.body === 'object' ? req.body : {};
  const customerSnapshot = await customers.doc(String(Number(customerId))).get();
  const boxes = Number(totalBoxes);

  if (!customerSnapshot.exists) {
    return res.status(400).json({ message: 'ไม่พบข้อมูลลูกค้าที่เลือก' });
  }
  if (!Number.isInteger(boxes) || boxes < 1 || boxes > pricing.maxBoxesPerOrder) {
    return res.status(400).json({ message: `จำนวนกล่องต้องอยู่ระหว่าง 1-${pricing.maxBoxesPerOrder} กล่องต่อออเดอร์` });
  }

  let order;
  await db.runTransaction(async (transaction) => {
    const counterSnapshot = await transaction.get(counters);
    const id = Number(counterSnapshot.data()?.nextOrderId) || 1;
    order = {
      id,
      customerId: customerSnapshot.data().id,
      totalBoxes: boxes,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    transaction.set(orders.doc(String(id)), order);
    transaction.set(counters, { nextOrderId: id + 1 }, { merge: true });
  });
  invalidateRoutePlan();

  return res.status(201).json({
    success: true,
    data: await serializeOrder(order, [customerSnapshot.data()])
  });
});

const updateOrder = asyncHandler(async (req, res) => {
  const reference = orders.doc(String(Number(req.params.id)));
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    return res.status(404).json({ message: 'ไม่พบออเดอร์ที่ต้องการแก้ไข' });
  }

  const order = snapshot.data();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const updates = {};

  if (body.customerId !== undefined) {
    const customerSnapshot = await customers.doc(String(Number(body.customerId))).get();
    if (!customerSnapshot.exists) {
      return res.status(400).json({ message: 'ไม่พบข้อมูลลูกค้าที่เลือก' });
    }
    updates.customerId = customerSnapshot.data().id;
  }

  if (body.totalBoxes !== undefined) {
    const boxes = Number(body.totalBoxes);
    if (!Number.isInteger(boxes) || boxes < 1 || boxes > pricing.maxBoxesPerOrder) {
      return res.status(400).json({ message: `จำนวนกล่องต้องอยู่ระหว่าง 1-${pricing.maxBoxesPerOrder} กล่องต่อออเดอร์` });
    }
    updates.totalBoxes = boxes;
  }

  if (body.status !== undefined) {
    if (!allowedStatuses.has(body.status)) {
      return res.status(400).json({ message: 'สถานะออเดอร์ไม่ถูกต้อง' });
    }
    updates.status = body.status;
  }

  const updatedOrder = { ...order, ...updates };
  if (Object.keys(updates).length > 0) {
    await reference.update(updates);
    invalidateRoutePlan();
  }
  return res.json({ success: true, data: await serializeOrder(updatedOrder) });
});

const deleteOrder = asyncHandler(async (req, res) => {
  const reference = orders.doc(String(Number(req.params.id)));
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    return res.status(404).json({ message: 'ไม่พบออเดอร์ที่ต้องการลบ' });
  }

  const deletedOrder = snapshot.data();
  await reference.delete();
  invalidateRoutePlan();
  return res.json({ success: true, data: await serializeOrder(deletedOrder) });
});

module.exports = { getOrders, createOrder, updateOrder, deleteOrder };
