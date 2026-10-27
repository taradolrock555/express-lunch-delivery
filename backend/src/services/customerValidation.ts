import { pricing, shop } from '../config/delivery';
import type { CustomerInput } from '../types';
import { badRequest } from '../utils/errors';
import { asNumber, asString } from '../utils/validate';
import { haversineDistanceKm } from './geo';

export function parseCustomerInput(body: unknown): CustomerInput {
  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const customer: CustomerInput = {
    name: asString(input.name, 'ชื่อลูกค้า', 100),
    phone: asString(input.phone, 'เบอร์โทร', 20),
    address: asString(input.address, 'ที่อยู่', 255),
    latitude: asNumber(input.latitude, 'ละติจูด', -90, 90),
    longitude: asNumber(input.longitude, 'ลองจิจูด', -180, 180),
  };

  const distanceFromShop = haversineDistanceKm(shop, customer);
  if (distanceFromShop > pricing.maxCustomerDistanceKm) {
    throw badRequest(
      `พิกัดลูกค้าต้องอยู่ภายในรัศมี ${pricing.maxCustomerDistanceKm} กม. จากร้าน (วัดเป็นระยะเส้นตรง)`,
    );
  }

  return customer;
}
