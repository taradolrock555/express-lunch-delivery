# Frontend — Rider Route Management

Angular 22 frontend สำหรับระบบจัดเส้นทางและแบ่งงานไรเดอร์

## เริ่มต้นใช้งาน

ต้องรัน backend ก่อนที่ `http://localhost:3000`

```powershell
cd frontend
npm install
npm start
```

เปิด `http://localhost:4200`

## หน้าจอ

| Route | หน้าจอ | รายละเอียด |
| --- | --- | --- |
| `/owner-dashboard` | จัดการออเดอร์ | สรุปภาพรวม, เพิ่ม/แก้ไข/ลบออเดอร์, เลือกไรเดอร์เองหรือจัดอัตโนมัติ, เปลี่ยนสถานะ |
| `/customers` | จัดการลูกค้า | ข้อมูลติดต่อ, พิกัด, ค้นหาที่อยู่, แผนที่ |
| `/route-planning` | วางแผนเส้นทาง | แผนที่แยกสีตามไรเดอร์, ต้นทุน/กำไร/เวลา, คำนวณใหม่, เผยแพร่ |
| `/rider-tasks` | คิวงานไรเดอร์ | ค้นหาด้วยรหัสพนักงาน, ลำดับจุดส่ง, Google Maps, โทร |

รหัสไรเดอร์ตัวอย่าง: `JOB-001` ถึง `JOB-010` (ต้องกดเผยแพร่แผนก่อน)

## การเชื่อมต่อ API

`src/app/services/api.config.ts` อ่าน URL จาก `public/app-config.js` ก่อน
และใช้ค่าเริ่มต้น `http://<hostname>:3000/api` เมื่อเปิด Angular ที่พอร์ต 4200:

```ts
// เปิดหน้าเว็บที่ http://192.168.3.182:4200
// จะเรียก API ที่ http://192.168.3.182:3000/api
export const API_BASE_URL = `http://${browserHostname}:3000/api`;
```

จึงใช้ได้ทั้ง `localhost` และเครื่องอื่นในวง Wi-Fi เดียวกัน (ตั้ง `CORS_ORIGIN`
ใน backend ให้ตรงกับ origin ของหน้าเว็บด้วย)

เมื่อนำ Front-end และ Back-end ไป deploy คนละ URL ให้แก้ `apiBaseUrl` ใน
`public/app-config.js` เป็น URL ของ backend ที่ลงท้ายด้วย `/api` แล้ว build/deploy ใหม่
ตัวอย่าง: `https://your-backend.example.com/api` (ไม่ต้องใส่เครื่องหมาย `/` ปิดท้าย)

## เปิดจากเครื่องอื่น

`npm start` รันด้วย `ng serve --host 0.0.0.0` เพื่อให้เครื่องอื่นเชื่อมต่อได้

1. หา IPv4 ของเครื่องที่รัน frontend ด้วย `ipconfig`
2. เปิดจากเครื่องอื่นที่ต่อเครือข่ายเดียวกัน:

```text
http://<IPv4>:4200
```

ตัวอย่าง: `http://192.168.3.182:4200`

ถ้าเปิดไม่ได้ ให้อนุญาต Node.js ผ่าน Windows Firewall สำหรับพอร์ต 3000 และ 4200
(ดูรายละเอียดใน README หลัก)

## โครงสร้างหลัก

```text
src/app/
├── app.component.*          # top bar + router outlet
├── app.routes.ts
├── customer-management/     # CRUD ลูกค้า + Leaflet map
├── owner-dashboard/         # CRUD ออเดอร์ + summary
├── route-planning/          # แผนที่เส้นทาง + ต้นทุน + เผยแพร่
├── rider-tasks/             # ใบงานไรเดอร์
└── services/
    ├── api.config.ts
    ├── customer.service.ts
    ├── order.service.ts
    ├── rider.service.ts
    ├── rider-task.service.ts
    └── route-planning.service.ts
```

## คุณสมบัติของ UI

- Angular standalone components และ signals
- แผนที่ Leaflet + OpenStreetMap
- สีเส้นทาง 10 สี รองรับไรเดอร์สูงสุด 10 คน
- ระบบจัดไรเดอร์อัตโนมัติ; เจ้าของกำหนดไรเดอร์รายออเดอร์เพื่อ override ได้
- จำกัดลูกค้า 1 คนต่อ 1 ออเดอร์ค้าง และจำกัดไรเดอร์ไม่เกิน 3 ออเดอร์ที่ยังไม่เสร็จ
- จำกัดพิกัดลูกค้าให้อยู่ในรัศมีเส้นตรง 3 กม. จากร้าน
- แสดงค่าส่ง กำไร เวลา และคำเตือนเมื่อเกินงบ/ต่ำกว่าเป้า/เกินเวลา
- รองรับหน้าจอมือถือสำหรับหน้าไรเดอร์
- แสดงข้อความ error จาก API โดยตรง

## Scripts

```powershell
npm start      # dev server
npm run build  # production build
npm test       # unit tests (Vitest)
```

## Build

```powershell
npm run build
```

ผลลัพธ์จะอยู่ที่ `dist/rider-route-frontend`

## หมายเหตุ

- ต้องมี backend รันอยู่ ไม่มี mock service ใน frontend
- แผนที่และ OSRM ต้องใช้อินเทอร์เน็ต
- การแก้ไขข้อมูลจะทำให้แผนที่เผยแพร่ถูกยกเลิก ต้องกดเผยแพร่ใหม่
- ข้อมูลออเดอร์/ลูกค้าเก็บถาวรใน SQLite ไม่ใช่ mock ในหน่วยความจำ
- ยังไม่มี login; อย่าเปิดให้เครือข่ายที่ไม่เชื่อถือหรือใช้กับข้อมูลลูกค้าจริง
