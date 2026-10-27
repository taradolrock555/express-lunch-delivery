import { SqliteStore } from './sqlite';
import type { Store } from './store';

/**
 * ค่าเริ่มต้นใช้ SQLite ที่มากับ Node.js 22 (ไม่ต้องติดตั้งฐานข้อมูลเพิ่ม)
 * เปลี่ยนไฟล์ฐานข้อมูลได้ด้วยตัวแปร SQLITE_FILE ใน .env
 */
export const store: Store = new SqliteStore();
