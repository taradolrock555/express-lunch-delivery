import type { Customer, Order, Rider } from '../types';

export const mockCustomers: Customer[] = [
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
  { id: 20, name: 'ศุภชัย ใจเย็น', phone: '0800000020', address: 'หอพักฝั่งเหนือของมหาวิทยาลัย', latitude: 16.2638, longitude: 103.2612 },
  { id: 21, name: 'อารีย์ ใจดี', phone: '0800000021', address: 'หอพักโซนตะวันตก มมส.', latitude: 16.2448, longitude: 103.2415 },
  { id: 22, name: 'ธนวัฒน์ ขยัน', phone: '0800000022', address: 'ชุมชนท่าขอนยางเหนือ', latitude: 16.2522, longitude: 103.2622 },
  { id: 23, name: 'กัญญา ตั้งใจ', phone: '0800000023', address: 'หอพักฝั่งตะวันตกขามเรียง', latitude: 16.2420, longitude: 103.2420 },
  { id: 24, name: 'ภาณุวัฒน์ ใจเย็น', phone: '0800000024', address: 'ชุมชนใกล้ประตูท่าขอนยาง', latitude: 16.2480, longitude: 103.2600 },
  { id: 25, name: 'สุรีย์พร รักงาน', phone: '0800000025', address: 'อาคารเรียนโซนเหนือ', latitude: 16.2550, longitude: 103.2510 },
  { id: 26, name: 'ธนกฤต ขยัน', phone: '0800000026', address: 'หอพักชุมชนขามเรียงใต้', latitude: 16.2350, longitude: 103.2500 },
  { id: 27, name: 'พัชรี ใจดี', phone: '0800000027', address: 'อาคารเรียนฝั่งตะวันออก', latitude: 16.2450, longitude: 103.2600 },
  { id: 28, name: 'ภัทรพล มีสุข', phone: '0800000028', address: 'ชุมชนขามเรียงตะวันออก', latitude: 16.2550, longitude: 103.2400 },
  { id: 29, name: 'อัญชลี ขยัน', phone: '0800000029', address: 'หอพักท่าขอนยางใต้', latitude: 16.2350, longitude: 103.2600 },
  { id: 30, name: 'ปกรณ์ รักงาน', phone: '0800000030', address: 'ชุมชนขามเรียงตอนเหนือ', latitude: 16.2550, longitude: 103.2600 },
];

export const mockRiders: Rider[] = [
  { id: 1, name: 'วิชัย ไรเดอร์', jobCode: 'JOB-001', status: 'available' },
  { id: 2, name: 'มานี ไรเดอร์', jobCode: 'JOB-002', status: 'available' },
  { id: 3, name: 'ปิติ ไรเดอร์', jobCode: 'JOB-003', status: 'available' },
  { id: 4, name: 'กมล ไรเดอร์', jobCode: 'JOB-004', status: 'available' },
  { id: 5, name: 'ธนา ไรเดอร์', jobCode: 'JOB-005', status: 'available' },
  { id: 6, name: 'รัตนา ไรเดอร์', jobCode: 'JOB-006', status: 'available' },
  { id: 7, name: 'เอกชัย ไรเดอร์', jobCode: 'JOB-007', status: 'available' },
  { id: 8, name: 'อารีย์ ไรเดอร์', jobCode: 'JOB-008', status: 'available' },
  { id: 9, name: 'กัญญา ไรเดอร์', jobCode: 'JOB-009', status: 'available' },
  { id: 10, name: 'ภาณุวัฒน์ ไรเดอร์', jobCode: 'JOB-010', status: 'available' },
];

const createdAt = (minute: number) =>
  new Date(Date.UTC(2026, 9, 12, 3, minute, 0)).toISOString();

export const mockOrders: Order[] = [
  ...Array.from({ length: 20 }, (_, index) => {
    const id = index + 1;
    return {
      id,
      customerId: id,
      riderId: null,
      assignmentMode: 'auto' as const,
      totalBoxes: (index % 3) + 1,
      status: 'ready' as const,
      createdAt: createdAt(2 + index * 3),
      updatedAt: createdAt(2 + index * 3),
    };
  }),
  {
    id: 21,
    customerId: 21,
    riderId: null,
    assignmentMode: 'auto',
    totalBoxes: 1,
    status: 'pending',
    createdAt: createdAt(62),
    updatedAt: createdAt(62),
  },
  {
    id: 22,
    customerId: 22,
    riderId: null,
    assignmentMode: 'auto',
    totalBoxes: 2,
    status: 'pending',
    createdAt: createdAt(65),
    updatedAt: createdAt(65),
  },
];
