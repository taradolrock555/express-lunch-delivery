const { db } = require('../config/firebase');
const asyncHandler = require('../utils/asyncHandler');
const { invalidateRoutePlan } = require('./routeController');

const customers = db.collection('customers');
const orders = db.collection('orders');
const counters = db.collection('_metadata').doc('counters');

function validateCustomer(body) {
  const input = body && typeof body === 'object' ? body : {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);

  if (!name || !phone || !address) {
    return { error: 'กรุณากรอกชื่อ เบอร์โทร และที่อยู่ให้ครบ' };
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { error: 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90' };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180' };
  }

  return { customer: { name, phone, address, latitude, longitude } };
}

const getCustomers = asyncHandler(async (req, res) => {
  const snapshot = await customers.get();
  const data = snapshot.docs
    .map((document) => document.data())
    .sort((a, b) => a.id - b.id);
  res.json({ success: true, data });
});

const createCustomer = asyncHandler(async (req, res) => {
  const result = validateCustomer(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  let customer;
  await db.runTransaction(async (transaction) => {
    const counterSnapshot = await transaction.get(counters);
    const id = Number(counterSnapshot.data()?.nextCustomerId) || 1;
    customer = { id, ...result.customer };
    transaction.set(customers.doc(String(id)), customer);
    transaction.set(counters, { nextCustomerId: id + 1 }, { merge: true });
  });
  invalidateRoutePlan();
  return res.status(201).json({ success: true, data: customer });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = validateCustomer(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const reference = customers.doc(String(id));
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
  }

  const customer = { ...snapshot.data(), ...result.customer };
  await reference.set(customer);
  invalidateRoutePlan();
  return res.json({ success: true, data: customer });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);
  const reference = customers.doc(String(customerId));
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
  }

  const orderSnapshot = await orders.where('customerId', '==', customerId).limit(1).get();
  if (!orderSnapshot.empty) {
    return res.status(409).json({ message: 'ลบไม่ได้ เนื่องจากลูกค้ามีออเดอร์อยู่ในระบบ' });
  }

  const deletedCustomer = snapshot.data();
  await reference.delete();
  invalidateRoutePlan();
  return res.json({ success: true, data: deletedCustomer });
});

module.exports = { getCustomers, createCustomer, updateCustomer, deleteCustomer };
