const mockData = require('../data/mockData');

const allowedStatuses = new Set(['pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']);

function serializeOrder(order) {
  const customer = mockData.customers.find((item) => item.id === order.customerId);

  return {
    ...order,
    customerName: customer ? customer.name : 'ไม่พบข้อมูลลูกค้า',
    customerPhone: customer ? customer.phone : '',
    pickupAddress: mockData.shop.address,
    deliveryAddress: customer ? customer.address : '',
    latitude: customer ? customer.latitude : null,
    longitude: customer ? customer.longitude : null
  };
}

function getOrders(req, res) {
  res.json({ success: true, data: mockData.orders.map(serializeOrder) });
}

function createOrder(req, res) {
  const { customerId, totalBoxes } = req.body && typeof req.body === 'object' ? req.body : {};
  const customer = mockData.customers.find((item) => item.id === Number(customerId));
  const boxes = Number(totalBoxes);

  if (!customer) {
    return res.status(400).json({ message: 'ไม่พบข้อมูลลูกค้าที่เลือก' });
  }
  if (!Number.isInteger(boxes) || boxes < 1 || boxes > mockData.pricing.maxBoxesPerOrder) {
    return res.status(400).json({ message: `จำนวนกล่องต้องอยู่ระหว่าง 1-${mockData.pricing.maxBoxesPerOrder} กล่องต่อออเดอร์` });
  }

  const order = {
    id: mockData.nextOrderId++,
    customerId: customer.id,
    totalBoxes: boxes,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  mockData.orders.push(order);
  mockData.currentRoutePlan = null;

  return res.status(201).json({ success: true, data: serializeOrder(order) });
}

function updateOrder(req, res) {
  const order = mockData.orders.find((item) => item.id === Number(req.params.id));
  if (!order) {
    return res.status(404).json({ message: 'ไม่พบออเดอร์ที่ต้องการแก้ไข' });
  }

  const { customerId, totalBoxes, status } = req.body && typeof req.body === 'object' ? req.body : {};
  if (customerId !== undefined) {
    const customer = mockData.customers.find((item) => item.id === Number(customerId));
    if (!customer) {
      return res.status(400).json({ message: 'ไม่พบข้อมูลลูกค้าที่เลือก' });
    }
    order.customerId = customer.id;
  }

  if (totalBoxes !== undefined) {
    const boxes = Number(totalBoxes);
    if (!Number.isInteger(boxes) || boxes < 1 || boxes > mockData.pricing.maxBoxesPerOrder) {
      return res.status(400).json({ message: `จำนวนกล่องต้องอยู่ระหว่าง 1-${mockData.pricing.maxBoxesPerOrder} กล่องต่อออเดอร์` });
    }
    order.totalBoxes = boxes;
  }

  if (status !== undefined) {
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: 'สถานะออเดอร์ไม่ถูกต้อง' });
    }
    order.status = status;
  }

  mockData.currentRoutePlan = null;
  return res.json({ success: true, data: serializeOrder(order) });
}

function deleteOrder(req, res) {
  const index = mockData.orders.findIndex((item) => item.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ message: 'ไม่พบออเดอร์ที่ต้องการลบ' });
  }

  const [deletedOrder] = mockData.orders.splice(index, 1);
  mockData.currentRoutePlan = null;
  return res.json({ success: true, data: serializeOrder(deletedOrder) });
}

module.exports = { getOrders, createOrder, updateOrder, deleteOrder };
