const mockData = require('../data/mockData');

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

function getCustomers(req, res) {
  res.json({ success: true, data: mockData.customers });
}

function createCustomer(req, res) {
  const result = validateCustomer(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const customer = { id: mockData.nextCustomerId++, ...result.customer };
  mockData.customers.push(customer);
  return res.status(201).json({ success: true, data: customer });
}

function updateCustomer(req, res) {
  const customer = mockData.customers.find((item) => item.id === Number(req.params.id));
  if (!customer) {
    return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
  }

  const result = validateCustomer(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  Object.assign(customer, result.customer);
  mockData.currentRoutePlan = null;
  return res.json({ success: true, data: customer });
}

function deleteCustomer(req, res) {
  const customerId = Number(req.params.id);
  const index = mockData.customers.findIndex((item) => item.id === customerId);
  if (index === -1) {
    return res.status(404).json({ message: 'ไม่พบข้อมูลลูกค้า' });
  }
  if (mockData.orders.some((item) => item.customerId === customerId)) {
    return res.status(409).json({ message: 'ลบไม่ได้ เนื่องจากลูกค้ามีออเดอร์อยู่ในระบบ' });
  }

  const [deletedCustomer] = mockData.customers.splice(index, 1);
  mockData.currentRoutePlan = null;
  return res.json({ success: true, data: deletedCustomer });
}

module.exports = { getCustomers, createCustomer, updateCustomer, deleteCustomer };
