import test from 'node:test';
import assert from 'node:assert/strict';
import { asEnum, asInt, asNumber, asString, asTime } from '../src/utils/validate';
import { todayInBangkok } from '../src/services/routePlanner';

test('validates and trims required strings', () => {
  assert.equal(asString('  สมชาย  ', 'ชื่อ', 20), 'สมชาย');
  assert.throws(() => asString('', 'ชื่อ', 20), /กรุณากรอกชื่อ/);
  assert.throws(() => asString('a'.repeat(21), 'ชื่อ', 20), /ยาวเกินไป/);
});

test('validates integer ranges', () => {
  assert.equal(asInt('3', 'จำนวนกล่อง', 1, 3), 3);
  assert.throws(() => asInt(4, 'จำนวนกล่อง', 1, 3), /ระหว่าง 1 ถึง 3/);
  assert.throws(() => asInt(1.5, 'จำนวนกล่อง', 1, 3), /จำนวนเต็ม/);
});

test('rejects empty and non-numeric coordinate values', () => {
  assert.equal(asNumber('16.2452', 'ละติจูด', -90, 90), 16.2452);
  assert.throws(() => asNumber('', 'ละติจูด', -90, 90), /ต้องเป็นตัวเลข/);
  assert.throws(() => asNumber(null, 'ลองจิจูด', -180, 180), /ต้องเป็นตัวเลข/);
  assert.throws(() => asNumber(true, 'ละติจูด', -90, 90), /ต้องเป็นตัวเลข/);
});

test('validates enums and times', () => {
  assert.equal(asEnum('ready', ['pending', 'ready'] as const, 'สถานะ'), 'ready');
  assert.throws(() => asEnum('unknown', ['pending', 'ready'] as const, 'สถานะ'), /ไม่ถูกต้อง/);
  assert.equal(asTime('11:30', 'เวลา'), '11:30');
  assert.throws(() => asTime('25:00', 'เวลา'), /HH:MM/);
});

test('uses a Bangkok calendar date for the plan', () => {
  assert.match(todayInBangkok(), /^\d{4}-\d{2}-\d{2}$/);
});
