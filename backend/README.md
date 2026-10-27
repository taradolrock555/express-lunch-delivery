# Backend — Express Lunch Delivery API

Node.js Web API สำหรับระบบจัดเส้นทางและแบ่งงานไรเดอร์ เขียนด้วย **TypeScript + Express 5**
และเก็บข้อมูลด้วย **SQLite** ผ่าน built-in module `node:sqlite`

## ความต้องการของระบบ

- Node.js **22.13 ขึ้นไป** (`node:sqlite` ไม่ต้องใช้ flag ตั้งแต่เวอร์ชันนี้)
- npm
- ไม่ต้องติดตั้ง SQLite server หรือ Firebase

## เริ่มต้นใช้งาน

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run seed
npm run dev
```

- API: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`
- เอกสารรายการ endpoint แบบสั้น: `http://localhost:3000/api/docs`
- เครื่องอื่นในวงเดียวกัน: `http://<IPv4-ของเครื่องนี้>:3000/api/health`
  (ต้องอนุญาต Node.js ผ่าน Windows Firewall)

ถ้าไม่สร้าง `.env` ระบบจะใช้ค่าเริ่มต้นทั้งหมด และสร้างฐานข้อมูลที่
`backend/data/lunch-delivery.db`

## Environment variables

คัดลอกจาก `.env.example`:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
| --- | --- | --- |
| `PORT` | `3000` | พอร์ตของ API |
| `CORS_ORIGIN` | localhost ของ Angular | origin ที่อนุญาต คั่นหลาย origin ด้วย comma |
| `SQLITE_FILE` | `./data/lunch-delivery.db` | ไฟล์ฐานข้อมูล ใช้ `:memory:` ใน test ได้ |
| `SHOP_NAME` | ชื่อร้านตามโจทย์ | ชื่อร้าน |
| `SHOP_ADDRESS` | ที่อยู่ร้าน | จุดเริ่มต้นของไรเดอร์ |
| `SHOP_LATITUDE` | `16.2452` | ละติจูดร้าน |
| `SHOP_LONGITUDE` | `103.2501` | ลองจิจูดร้าน |
| `SALE_PRICE_PER_BOX` | `65` | ราคาขายต่อกล่อง |
| `FOOD_COST_PER_BOX` | `40` | ต้นทุนอาหารต่อกล่อง |
| `RIDER_FEE_PER_TRIP` | `15` | ค่าส่งต่อเที่ยว |
| `RIDER_COST_PER_KM_PER_BOX` | `2` | ค่าส่งต่อกิโลเมตรต่อกล่อง |
| `RIDER_SPEED_KMH` | `30` | ความเร็วไรเดอร์ |
| `DEPARTURE_TIME` | `11:30` | เวลาออกเดินทาง |
| `DEADLINE_TIME` | `12:30` | เวลาส่งถึงไม่เกิน |
| `MAX_BOXES_PER_ORDER` | `3` | จำนวนกล่องสูงสุดต่อออเดอร์ |
| `MAX_ORDERS_PER_RIDER` | `3` | จำนวนออเดอร์สูงสุดต่อไรเดอร์ |
| `DAILY_DELIVERY_BUDGET` | `500` | งบค่าส่งต่อวัน (บาท) |
| `TARGET_PROFIT` | `300` | กำไรสุทธิขั้นต่ำที่ต้องการ (บาท) |
| `OSRM_BASE_URL` | `https://router.project-osrm.org` | เซิร์ฟเวอร์ OSRM |
| `OSRM_TIMEOUT_MS` | `3000` | เวลารอ OSRM ก่อน fallback |

> ห้าม commit ไฟล์ `.env` หรือฐานข้อมูลจริง

## Scripts

```powershell
npm run dev        # tsx watch src/server.ts
npm start          # tsx src/server.ts
npm run seed       # ล้างและใส่ข้อมูลตัวอย่างใหม่
npm test           # node --import tsx --test test/*.test.ts
npm run typecheck  # tsc --noEmit
npm run build      # compile ไป dist/
npm run start:prod # node dist/server.js
```

## โครงสร้าง source

```text
src/
├── app.ts                 # Express app, middleware, error handler
├── server.ts              # start server + graceful shutdown
├── seed.ts                # reset และ seed ข้อมูลตัวอย่าง
├── types.ts               # type ของ domain/API
├── config/delivery.ts     # ราคา เวลา ร้าน
├── controllers/           # request handlers
├── routes/                # Express routers
├── db/
│   ├── schema.ts          # SQL schema
│   ├── sqlite.ts          # SqliteStore
│   ├── store.ts           # Store interface
│   └── index.ts           # singleton store
├── services/
│   ├── geo.ts             # OSRM + Haversine
│   ├── routeOptimizer.ts  # grouping/local search
│   └── routePlanner.ts    # compute/publish/read rider task
└── utils/
    ├── asyncHandler.ts
    ├── errors.ts
    └── validate.ts
```

## ข้อมูลตัวอย่าง

`npm run seed` จะล้างตารางและสร้าง:

- ลูกค้า 30 ราย พร้อมพิกัดรอบมหาวิทยาลัยมหาสารคาม
- ไรเดอร์ 10 คน รหัส `JOB-001` … `JOB-010`
- ออเดอร์พร้อมจัดส่ง 20 รายการ (สถานะ `ready`)
- ออเดอร์รอดำเนินการ 2 รายการ (สถานะ `pending`)
- ออเดอร์เริ่มต้นเป็นโหมดจัดไรเดอร์อัตโนมัติ; ลูกค้าแต่ละคนมีออเดอร์ค้างไม่เกิน 1 รายการ

ไรเดอร์ 10 คนรองรับออเดอร์ที่ยังไม่เสร็จได้สูงสุด 30 รายการ จึงครอบคลุมขอบเขตบนของโจทย์

## Database schema

| ตาราง | ข้อมูล |
| --- | --- |
| `customers` | ชื่อ, เบอร์โทร, ที่อยู่, ละติจูด, ลองจิจูด |
| `riders` | ชื่อ, `job_code` (unique), สถานะ |
| `orders` | ลูกค้า, ไรเดอร์ที่เลือก/โหมดอัตโนมัติ, จำนวนกล่อง (1–3), สถานะ, เวลา |
| `route_plans` | เก็บแผนล่าสุดเป็น JSON (แถวเดียว id = 1) |

- เปิด foreign key และใช้ `ON DELETE RESTRICT` กับออเดอร์
- ลบลูกค้าที่มีออเดอร์อยู่ไม่ได้ (ตอบ HTTP 409)
- เก็บแผนที่เผยแพร่ล่าสุดไว้ในฐานข้อมูล เพื่อให้ rider task ยังใช้งานได้หลัง restart

## Response format

สำเร็จ:

```json
{
  "success": true,
  "data": {}
}
```

ผิดพลาด:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "จำนวนกล่องต้องเป็นตัวเลขระหว่าง 1 ถึง 3",
    "details": null
  },
  "message": "จำนวนกล่องต้องเป็นตัวเลขระหว่าง 1 ถึง 3"
}
```

รหัส error ที่ใช้:

- `VALIDATION_ERROR` (400)
- `INVALID_JSON` (400)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `INTERNAL_ERROR` (500)

## API endpoints

### Health / config

| Method | Path | คำอธิบาย |
| --- | --- | --- |
| GET | `/api/health` | สถานะเซิร์ฟเวอร์ |
| GET | `/api/config` | ข้อมูลร้านและราคา |
| GET | `/api/docs` | รายการ endpoint |

### Customers

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/customers` | — |
| POST | `/api/customers` | `name`, `phone`, `address`, `latitude`, `longitude` |
| PUT | `/api/customers/:id` | เหมือน POST |
| DELETE | `/api/customers/:id` | — |

ตัวอย่าง:

```json
{
  "name": "สมชาย ใจดี",
  "phone": "0800000001",
  "address": "หอพักใกล้ มมส. ฝั่งขามเรียง",
  "latitude": 16.2432,
  "longitude": 103.2492
}
```

### Orders

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/orders` | — |
| POST | `/api/orders` | `customerId`, `totalBoxes`, `riderId?` (ไม่ส่งหรือ `null` = จัดอัตโนมัติ) |
| PUT | `/api/orders/:id` | `customerId?`, `riderId?`, `totalBoxes?`, `status?` |
| DELETE | `/api/orders/:id` | — |

สถานะที่รองรับ:

```text
pending | preparing | ready | delivering | delivered | cancelled
```

ตัวอย่าง:

```json
{
  "customerId": 1,
  "riderId": 1,
  "totalBoxes": 3
}
```

กติกาการสั่งซื้อ:

- ลูกค้า 1 คนมีออเดอร์ที่ยังไม่เสร็จ (`pending`, `preparing`, `ready`, `delivering`) ได้ครั้งละ 1 ออเดอร์
- ต้องเปลี่ยนออเดอร์เดิมเป็น `delivered` หรือ `cancelled` ก่อนจึงจะสร้างรอบใหม่ให้ลูกค้าคนเดิมได้
- ไรเดอร์ 1 คนมีออเดอร์ที่ยังไม่เสร็จได้ไม่เกิน 3 ออเดอร์
- ถ้าไม่กำหนด `riderId` ระบบจะจัดไรเดอร์ให้อัตโนมัติเมื่อ preview/publish
- ถ้ากำหนด `riderId` จะถือเป็น manual override และ optimizer จะคงไรเดอร์นั้นไว้

การเพิ่ม/แก้ไข/ลบลูกค้าหรือออเดอร์จะล้างแผนที่เผยแพร่ล่าสุดโดยอัตโนมัติ
เพื่อป้องกันไรเดอร์เห็นแผนเก่าที่ไม่ตรงกับข้อมูล

### Routes

| Method | Path | Body | คำอธิบาย |
| --- | --- | --- | --- |
| POST | `/api/routes/preview` | `{ "strategy": "alternative" }` | คำนวณแผน ไม่บันทึก |
| POST | `/api/routes/publish` | `{ "strategy": "alternative" }` | คำนวณและบันทึกแผน |
| GET | `/api/routes/current` | — | แผนที่เผยแพร่ล่าสุด |

`strategy`:

- `alternative` (ค่าเริ่มต้น) — แผนประหยัดต้นทุน
- `nearest` — แผนเปรียบเทียบที่เรียงจุดใกล้ร้านก่อน

ตัวอย่าง response (ย่อ):

```json
{
  "success": true,
  "data": {
    "strategy": "alternative",
    "planDate": "2026-10-27",
    "publishedAt": "2026-10-27T05:30:00.000Z",
    "shop": {
      "name": "ข้าวกล่องเดลิเวอรี ส่งด่วนมือเที่ยง",
      "address": "...",
      "latitude": 16.2452,
      "longitude": 103.2501
    },
    "pricing": {
      "salePricePerBox": 65,
      "foodCostPerBox": 40,
      "riderFeePerTrip": 15,
      "riderCostPerKmPerBox": 2,
      "riderSpeedKmh": 30,
      "departureTime": "11:30",
      "deadlineTime": "12:30",
      "maxBoxesPerOrder": 3,
      "maxOrdersPerRider": 3,
      "dailyDeliveryBudget": 500,
      "targetProfit": 300
    },
    "totals": {
      "totalBoxes": 39,
      "distanceKm": 16.14,
      "totalTravelMinutes": 36,
      "revenue": 2535,
      "foodCost": 1560,
      "deliveryCost": 289.18,
      "profit": 685.82,
      "allRoutesMeetDeadline": true,
      "budget": 500,
      "overBudget": false,
      "targetProfit": 300,
      "belowTargetProfit": false
    },
    "routes": [
      {
        "rider": {
          "id": 1,
          "name": "วิชัย ไรเดอร์",
          "jobCode": "JOB-001",
          "status": "available"
        },
        "stops": [
          {
            "id": 1,
            "customerName": "สมชาย ใจดี",
            "address": "หอพักใกล้ มมส. ฝั่งขามเรียง",
            "totalBoxes": 1,
            "sequenceNumber": 1,
            "latitude": 16.2432,
            "longitude": 103.2492
          }
        ],
        "distanceKm": 2.01,
        "travelMinutes": 5,
        "deliveryCost": 27.06,
        "profit": 47.94,
        "estimatedArrival": "11:35",
        "meetsDeadline": true
      }
    ]
  }
}
```

แต่ละ route จะมี `rider` ตามที่เจ้าของร้านเลือกไว้ในออเดอร์
และมี `distanceSource` บอกว่าใช้ระยะทางถนน OSRM หรือ Haversine สำรอง

ออเดอร์ `ready` ที่ไม่มี `riderId` จะถูกจัดให้อัตโนมัติ ส่วน override และออเดอร์ `delivering`
จะล็อกไรเดอร์ไว้ หากไรเดอร์ที่ล็อกไว้ไม่พร้อมหรือเกิน 3 ออเดอร์ ระบบจะตอบ `409`

### Riders

| Method | Path | คำอธิบาย |
| --- | --- | --- |
| GET | `/api/riders` | รายชื่อไรเดอร์ |
| GET | `/api/riders/tasks/:jobCode` | ใบงานของไรเดอร์ |

ตัวอย่าง:

```text
GET /api/riders/tasks/JOB-001
```

จะคืนข้อมูลงาน ประกอบด้วย

- `jobCode`, `rider`, `shop`, `planDate`, `publishedAt`, `isToday`
- `stops` พร้อม `sequenceNumber`, `customerPhone`, `address`, พิกัด
- `totalBoxes`, `distanceKm`, `travelMinutes`, `estimatedArrival`, `meetsDeadline`
- `deliveryCost`, `profit`

ถ้ายังไม่เคยเผยแพร่แผน จะตอบ `404` พร้อมข้อความให้เจ้าของร้านเผยแพร่แผนก่อน

### Geo

`POST /api/geo/route`

```json
{
  "coordinates": [
    { "latitude": 16.2452, "longitude": 103.2501 },
    { "latitude": 16.2471, "longitude": 103.2534 }
  ]
}
```

ผลลัพธ์มี `distanceKm`, `durationMinutes`, GeoJSON `geometry` และ `source`
 (`osrm` หรือ `haversine`)

## สูตรคำนวณ

```text
รายได้       = จำนวนกล่อง × 65
ต้นทุนอาหาร  = จำนวนกล่อง × 40
ค่าส่ง        = 15 + (ระยะทาง กม. × 2 × จำนวนกล่องในเที่ยว)
กำไรสุทธิ    = รายได้ − ต้นทุนอาหาร − ค่าส่ง
เวลาเดินทาง  = ระยะทาง กม. ÷ 30 × 60 นาที
```

เงื่อนไข:

- 1 ออเดอร์ ≤ 3 กล่อง
- 1 ไรเดอร์ ≤ 3 ออเดอร์ที่ยังไม่เสร็จ
- ลูกค้า 1 คนมีออเดอร์ที่ยังไม่เสร็จได้ครั้งละ 1 ออเดอร์
- พิกัดลูกค้าอยู่ภายในรัศมีเส้นตรง 3 กม. จากร้าน
- เวลาออก 11:30 น. และถึงไม่เกิน 12:30 น.
- ค่าส่งรวมต้องไม่เกิน `DAILY_DELIVERY_BUDGET`
- กำไรสุทธิควรไม่ต่ำกว่า `TARGET_PROFIT`

## ตัวจัดเส้นทางทำงานอย่างไร

1. โหลดลูกค้า ออเดอร์ และไรเดอร์จาก SQLite
2. เลือกออเดอร์ `ready` หรือ `delivering` และตรวจว่าทุกออเดอร์มีไรเดอร์ที่เลือกไว้
3. ล็อกออเดอร์ manual และออเดอร์ที่กำลังจัดส่งไว้กับไรเดอร์เดิม
4. ขอ OSRM distance table แล้วใช้ multi-start local search จัดกลุ่มออเดอร์อัตโนมัติ โดยคำนึงถึงค่าเที่ยวและค่าระยะทางต่อกล่อง
5. หาลำดับจุดส่งในแต่ละกลุ่มและตรวจจำนวนไม่เกิน 3 ออเดอร์/ไรเดอร์
6. คำนวณเส้นทางจริงต่อไรเดอร์ ตรวจเวลา และสรุปต้นทุน/กำไร
7. เผยแพร่แผนพร้อมบันทึกไรเดอร์ที่ระบบจัดให้และแผนใน SQLite transaction เดียว

> ตัวเลือก `alternative` จะลองจัดกลุ่มและลำดับจุดส่งเพื่อลดค่าส่ง ส่วน `nearest` ใช้เป็นแผนเปรียบเทียบ
> ผลของ optimizer เป็น heuristic ไม่รับประกัน global optimum; เมื่อใช้ OSRM Table ค่าที่ใช้เลือกแผนเป็นค่าประมาณ

## ขอบเขตและความปลอดภัย

- พิกัดลูกค้าต้องอยู่ในระยะเส้นตรงไม่เกิน 3 กม. จากร้าน
- ข้อมูลอยู่ใน SQLite บนเครื่องและคงอยู่หลัง restart; `npm run seed` จะล้างฐานข้อมูลแล้วใส่ตัวอย่างใหม่
- ตอนนี้ยังไม่มี authentication จึงไม่ควรเปิด API/หน้าไรเดอร์ให้เครือข่ายที่ไม่เชื่อถือ
- ใบงานมีเบอร์โทรและที่อยู่ลูกค้า; อย่าใช้ข้อมูลจริงหรือเปิดสู่อินเทอร์เน็ตจนกว่าจะเพิ่มการยืนยันตัวตน
- ตั้ง `CORS_ORIGIN` เป็น URL จริงของ Front-end เมื่อ deploy แยก host; CORS ไม่ใช่ระบบ authentication
- ใช้ `SQLITE_FILE` ชี้ไปยัง persistent disk/volume ของผู้ให้บริการ มิฉะนั้นข้อมูลอาจหายเมื่อ instance ถูกสร้างใหม่

## OSRM และ fallback

- ใช้ OSRM สาธารณะสำหรับระยะทางถนน
- ถ้า OSRM ตอบช้าเกิน `OSRM_TIMEOUT_MS` หรือเครือข่ายล่ม จะใช้ Haversine
- Haversine เป็นระยะเส้นตรง จึงอาจทำให้ค่าส่งต่ำกว่าความเป็นจริง
- response จะระบุ `source` / `distanceSource` ให้ตรวจสอบได้

## Tests

```powershell
npm test
```

ชุดทดสอบครอบคลุม:

- Haversine, validation ของพิกัด, GeoJSON fallback
- การจัดไรเดอร์อัตโนมัติ, manual overrides, เผยแพร่และโหลดใบงานจากแผนเดียวกัน
- การปฏิเสธพิกัดลูกค้าที่อยู่นอกระยะ 3 กม.
- การจัดลำดับจุดส่ง
- ขีดจำกัด 3 ออเดอร์/ไรเดอร์ และ 30 ออเดอร์/10 ไรเดอร์
- fairness และการแยกเที่ยวเมื่อถูกกว่า
- seed, CRUD ของ SQLite, การเก็บแผน
- validation ของ string/int/enum/time
- วันที่แบบเวลาไทย

## หมายเหตุการออกแบบ

- เปลี่ยนจาก Firebase Firestore เป็น SQLite เพราะโจทย์อนุญาตฐานข้อมูลบนเซิร์ฟเวอร์
  และทำให้อาจารย์/นักศึกษารันได้ทันทีโดยไม่ต้องมี service account
- ใช้ `node:sqlite` เพื่อลด dependency ภายนอก
- TypeScript เปิด `strict`
- Error handler กลางแปลง exception เป็น JSON ที่ frontend อ่าน `message` ได้
- ข้อมูลแผนถูกเก็บเป็น JSON เพื่อลดความซับซ้อนของ schema ในงาน demo
