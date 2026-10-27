import 'dotenv/config';
import type { Location, Pricing } from '../types';

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const textFromEnv = (name: string, fallback: string): string =>
  process.env[name]?.trim() || fallback;

export const shop: Location = {
  name: textFromEnv('SHOP_NAME', 'ข้าวกล่องเดลิเวอรี ส่งด่วนมือเที่ยง'),
  address: textFromEnv(
    'SHOP_ADDRESS',
    'ร้านข้าวกล่องเดลิเวอรี ใกล้มหาวิทยาลัยมหาสารคาม ตำบลขามเรียง อำเภอกันทรวิชัย จังหวัดมหาสารคาม',
  ),
  latitude: numberFromEnv('SHOP_LATITUDE', 16.2452),
  longitude: numberFromEnv('SHOP_LONGITUDE', 103.2501),
};

/**
 * ตัวเลขทั้งหมดอ้างอิงจากโจทย์ใน Project.pdf
 * - ขาย 65 บาท/กล่อง, ต้นทุนอาหาร 40 บาท/กล่อง
 * - ค่าส่ง 15 บาท/เที่ยว + 2 บาท/กม./กล่อง
 * - ไรเดอร์ขับ 30 กม./ชม., ต้องส่งถึงภายใน 1 ชั่วโมง (11:30–12:30)
 * - 1 ออเดอร์ไม่เกิน 3 กล่อง, 1 ไรเดอร์รับไม่เกิน 3 ออเดอร์
 */
export const pricing: Pricing = {
  salePricePerBox: numberFromEnv('SALE_PRICE_PER_BOX', 65),
  foodCostPerBox: numberFromEnv('FOOD_COST_PER_BOX', 40),
  riderFeePerTrip: numberFromEnv('RIDER_FEE_PER_TRIP', 15),
  riderCostPerKmPerBox: numberFromEnv('RIDER_COST_PER_KM_PER_BOX', 2),
  riderSpeedKmh: numberFromEnv('RIDER_SPEED_KMH', 30),
  departureTime: textFromEnv('DEPARTURE_TIME', '11:30'),
  deadlineTime: textFromEnv('DEADLINE_TIME', '12:30'),
  maxBoxesPerOrder: numberFromEnv('MAX_BOXES_PER_ORDER', 3),
  maxOrdersPerRider: numberFromEnv('MAX_ORDERS_PER_RIDER', 3),
  maxCustomerDistanceKm: 3,
  dailyDeliveryBudget: numberFromEnv('DAILY_DELIVERY_BUDGET', 500),
  targetProfit: numberFromEnv('TARGET_PROFIT', 300),
};
