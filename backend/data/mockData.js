const { shop, pricing } = require('../config/delivery');

const mockData = {
  shop,
  pricing,
  customers: [
    { id: 1, name: 'สมชาย ใจดี', phone: '0800000001', address: 'หอพักใกล้ มมส. ฝั่งขามเรียง', latitude: 16.2432, longitude: 103.2492 },
    { id: 2, name: 'สุดา รักงาน', phone: '0800000002', address: 'อาคารเรียนรวม มหาวิทยาลัยมหาสารคาม', latitude: 16.2471, longitude: 103.2534 },
    { id: 3, name: 'วิชัย ตั้งใจ', phone: '0800000003', address: 'หอพักโซนท่าขอนยาง', latitude: 16.2411, longitude: 103.2552 },
    { id: 4, name: 'มานี มีสุข', phone: '0800000004', address: 'ตลาดชุมชนขามเรียง', latitude: 16.2502, longitude: 103.2461 },
    { id: 5, name: 'ปิติ ขยัน', phone: '0800000005', address: 'อาคารสำนักงานใกล้มหาวิทยาลัย', latitude: 16.2385, longitude: 103.2473 },
    { id: 6, name: 'อรทัย ใจเย็น', phone: '0800000006', address: 'หอพักท่าขอนยาง', latitude: 16.2531, longitude: 103.2571 },
    { id: 7, name: 'กมลวรรณ ตั้งใจ', phone: '0800000007', address: 'หอพักโซนขามเรียงเหนือ', latitude: 16.2581, longitude: 103.2482 },
    { id: 8, name: 'ธนกร มีสุข', phone: '0800000008', address: 'ชุมชนท่าขอนยางตะวันตก', latitude: 16.2358, longitude: 103.2604 },
    { id: 9, name: 'รัตนา ใจดี', phone: '0800000009', address: 'อาคารเรียนโซนตะวันออก', latitude: 16.2495, longitude: 103.2631 },
    { id: 10, name: 'เอกชัย ขยัน', phone: '0800000010', address: 'หอพักใกล้ประตูมหาวิทยาลัย', latitude: 16.2327, longitude: 103.2428 },
    { id: 11, name: 'นภัสสร รักงาน', phone: '0800000011', address: 'ชุมชนขามเรียงใต้', latitude: 16.2601, longitude: 103.2588 },
    { id: 12, name: 'ธีรภัทร ใจเย็น', phone: '0800000012', address: 'อาคารสำนักงานท่าขอนยาง', latitude: 16.2298, longitude: 103.2574 },
    { id: 13, name: 'ชลธิชา ตั้งใจ', phone: '0800000013', address: 'หอพักฝั่งตะวันออกของมหาวิทยาลัย', latitude: 16.2559, longitude: 103.2398 },
    { id: 14, name: 'ภาคิน รักงาน', phone: '0800000014', address: 'ชุมชนใกล้แยกขามเรียง', latitude: 16.2374, longitude: 103.2642 },
    { id: 15, name: 'พิมพ์ชนก มีสุข', phone: '0800000015', address: 'หอพักชุมชนขามเรียงตะวันออก', latitude: 16.2623, longitude: 103.2447 },
    { id: 16, name: 'ณัฐวุฒิ ใจดี', phone: '0800000016', address: 'อาคารเรียนใกล้ถนนท่าขอนยาง', latitude: 16.2289, longitude: 103.2475 },
    { id: 17, name: 'สุภาวดี ขยัน', phone: '0800000017', address: 'หอพักด้านใต้ของมหาวิทยาลัย', latitude: 16.2334, longitude: 103.2628 },
    { id: 18, name: 'กิตติพงษ์ ตั้งใจ', phone: '0800000018', address: 'ชุมชนโซนขามเรียงตะวันตก', latitude: 16.2576, longitude: 103.2663 },
    { id: 19, name: 'เบญจมาศ รักงาน', phone: '0800000019', address: 'อาคารสำนักงานใกล้แยกท่าขอนยาง', latitude: 16.2265, longitude: 103.2531 },
    { id: 20, name: 'ศุภชัย ใจเย็น', phone: '0800000020', address: 'หอพักฝั่งเหนือของมหาวิทยาลัย', latitude: 16.2638, longitude: 103.2612 }
  ],
  riders: [
    { id: 1, name: 'วิชัย ไรเดอร์', jobCode: 'JOB-001', status: 'available' },
    { id: 2, name: 'มานี ไรเดอร์', jobCode: 'JOB-002', status: 'available' },
    { id: 3, name: 'ปิติ ไรเดอร์', jobCode: 'JOB-003', status: 'available' },
    { id: 4, name: 'กมล ไรเดอร์', jobCode: 'JOB-004', status: 'available' },
    { id: 5, name: 'ธนา ไรเดอร์', jobCode: 'JOB-005', status: 'available' },
    { id: 6, name: 'รัตนา ไรเดอร์', jobCode: 'JOB-006', status: 'available' },
    { id: 7, name: 'เอกชัย ไรเดอร์', jobCode: 'JOB-007', status: 'available' }
  ],
  orders: [
    { id: 1, customerId: 1, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:02:00.000Z' },
    { id: 2, customerId: 2, totalBoxes: 3, status: 'ready', createdAt: '2026-10-12T10:05:00.000Z' },
    { id: 3, customerId: 3, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:09:00.000Z' },
    { id: 4, customerId: 4, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:11:00.000Z' },
    { id: 5, customerId: 5, totalBoxes: 3, status: 'ready', createdAt: '2026-10-12T10:15:00.000Z' },
    { id: 6, customerId: 6, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:17:00.000Z' },
    { id: 7, customerId: 7, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:20:00.000Z' },
    { id: 8, customerId: 8, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:23:00.000Z' },
    { id: 9, customerId: 9, totalBoxes: 3, status: 'ready', createdAt: '2026-10-12T10:26:00.000Z' },
    { id: 10, customerId: 10, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:29:00.000Z' },
    { id: 11, customerId: 11, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:32:00.000Z' },
    { id: 12, customerId: 12, totalBoxes: 3, status: 'ready', createdAt: '2026-10-12T10:35:00.000Z' },
    { id: 13, customerId: 13, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:38:00.000Z' },
    { id: 14, customerId: 14, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:41:00.000Z' },
    { id: 15, customerId: 15, totalBoxes: 3, status: 'ready', createdAt: '2026-10-12T10:44:00.000Z' },
    { id: 16, customerId: 16, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:47:00.000Z' },
    { id: 17, customerId: 17, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:50:00.000Z' },
    { id: 18, customerId: 18, totalBoxes: 2, status: 'ready', createdAt: '2026-10-12T10:53:00.000Z' },
    { id: 19, customerId: 19, totalBoxes: 3, status: 'ready', createdAt: '2026-10-12T10:56:00.000Z' },
    { id: 20, customerId: 20, totalBoxes: 1, status: 'ready', createdAt: '2026-10-12T10:59:00.000Z' },
    { id: 21, customerId: 2, totalBoxes: 1, status: 'pending', createdAt: '2026-10-12T11:02:00.000Z' },
    { id: 22, customerId: 6, totalBoxes: 2, status: 'pending', createdAt: '2026-10-12T11:05:00.000Z' }
  ],
  currentRoutePlan: null,
  nextCustomerId: 21,
  nextOrderId: 23
};

module.exports = mockData;
