import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { pricing, shop } from './config/delivery';
import { customerRoutes } from './routes/customerRoutes';
import { geoRoutes } from './routes/geoRoutes';
import { orderRoutes } from './routes/orderRoutes';
import { riderRoutes } from './routes/riderRoutes';
import { routeRoutes } from './routes/routeRoutes';
import { sendError } from './utils/errors';

export const app = express();

const configuredCorsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = configuredCorsOrigins.length > 0
  ? configuredCorsOrigins
  : ['http://localhost:4200', 'http://127.0.0.1:4200'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Express Lunch Delivery API is running',
    api: '/api',
    docs: '/api/docs',
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.get('/api/config', (_req: Request, res: Response) => {
  res.json({ success: true, data: { shop, pricing } });
});

app.get('/api/docs', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      customers: [
        'GET /api/customers',
        'POST /api/customers',
        'PUT /api/customers/:id',
        'DELETE /api/customers/:id',
      ],
      orders: [
        'GET /api/orders',
        'POST /api/orders',
        'PUT /api/orders/:id',
        'DELETE /api/orders/:id',
      ],
      routes: [
        'POST /api/routes/preview',
        'POST /api/routes/publish',
        'GET /api/routes/current',
      ],
      riders: ['GET /api/riders', 'GET /api/riders/tasks/:jobCode'],
      geo: ['POST /api/geo/route'],
      config: ['GET /api/config', 'GET /api/health'],
    },
  });
});

app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/geo', geoRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'ไม่พบเส้นทางที่ร้องขอ', details: null },
    message: 'ไม่พบเส้นทางที่ร้องขอ',
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  sendError(res, error);
});
