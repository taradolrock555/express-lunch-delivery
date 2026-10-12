const mockData = {
  shop: {
    name: 'ส่งด่วนมื้อเที่ยง',
    address: 'มหาวิทยาลัยมหาสารคาม',
    latitude: 16.2452,
    longitude: 103.2501
  },
  pricing: {
    salePricePerBox: 65,
    foodCostPerBox: 40,
    riderFeePerTrip: 15,
    riderCostPerKmPerBox: 2,
    riderSpeedKmh: 30,
    departureTime: '11:30',
    deadlineTime: '12:30',
    maxBoxesPerOrder: 3,
    maxOrdersPerRider: 3
  },
  customers: [
    { id: 1, name: 'สมชาย ใจดี', phone: '0800000001', address: 'หอพักใกล้ มมส. ฝั่งขามเรียง', latitude: 16.2432, longitude: 103.2492 },
    { id: 2, name: 'สุดา รักงาน', phone: '0800000002', address: 'อาคารเรียนรวม มหาวิทยาลัยมหาสารคาม', latitude: 16.2471, longitude: 103.2534 },
    { id: 3, name: 'วิชัย ตั้งใจ', phone: '0800000003', address: 'หอพักโซนท่าขอนยาง', latitude: 16.2411, longitude: 103.2552 },
    { id: 4, name: 'มานี มีสุข', phone: '0800000004', address: 'ตลาดชุมชนขามเรียง', latitude: 16.2502, longitude: 103.2461 },
    { id: 5, name: 'ปิติ ขยัน', phone: '0800000005', address: 'อาคารสำนักงานใกล้มหาวิทยาลัย', latitude: 16.2385, longitude: 103.2473 },
    { id: 6, name: 'อรทัย ใจเย็น', phone: '0800000006', address: 'หอพักท่าขอนยาง', latitude: 16.2531, longitude: 103.2571 }
  ],
  riders: [
    { id: 1, name: 'วิชัย ไรเดอร์', jobCode: 'JOB-20261012-001', status: 'available' },
    { id: 2, name: 'มานี ไรเดอร์', jobCode: 'JOB-20261012-002', status: 'available' },
    { id: 3, name: 'ปิติ ไรเดอร์', jobCode: 'JOB-20261012-003', status: 'available' }
  ],
  orders: [
    { id: 1, customerId: 1, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:02:00.000Z' },
    { id: 2, customerId: 2, totalBoxes: 3, status: 'ready', createdAt: '2026-10-12T10:05:00.000Z' },
    { id: 3, customerId: 3, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:09:00.000Z' },
    { id: 4, customerId: 4, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:11:00.000Z' },
    { id: 5, customerId: 5, totalBoxes: 3, status: 'ready', createdAt: '2026-10-12T10:15:00.000Z' },
    { id: 6, customerId: 6, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:17:00.000Z' },
    { id: 7, customerId: 1, totalBoxes: 1, status: 'pending', createdAt: '2026-10-12T10:20:00.000Z' }
  ],
  currentRoutePlan: null,
  nextCustomerId: 7,
  nextOrderId: 8
};

module.exports = mockData;
