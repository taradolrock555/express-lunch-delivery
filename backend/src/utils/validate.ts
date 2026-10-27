import { badRequest } from './errors';

export function asString(value: unknown, field: string, maxLength = 255): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`กรุณากรอก${field}`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw badRequest(`${field}ยาวเกินไป (ไม่เกิน ${maxLength} ตัวอักษร)`);
  }
  return text;
}

export function asNumber(value: unknown, field: string, min: number, max: number): number {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(number) || number < min || number > max) {
    throw badRequest(`${field}ต้องเป็นตัวเลขระหว่าง ${min} ถึง ${max}`);
  }
  return number;
}

export function asInt(value: unknown, field: string, min: number, max: number): number {
  const number = asNumber(value, field, min, max);
  if (!Number.isInteger(number)) {
    throw badRequest(`${field}ต้องเป็นจำนวนเต็ม`);
  }
  return number;
}

export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${field}ไม่ถูกต้อง (ค่าที่รองรับ: ${allowed.join(', ')})`);
  }
  return value as T;
}

export function asTime(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw badRequest(`${field}ต้องอยู่ในรูปแบบ HH:MM`);
  }
  return value;
}
