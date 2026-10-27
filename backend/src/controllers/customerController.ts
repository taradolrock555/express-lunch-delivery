import type { Request, Response } from 'express';
import { store } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { conflict, notFound } from '../utils/errors';
import { invalidatePlan } from '../services/routePlanner';
import { parseCustomerInput } from '../services/customerValidation';

export const getCustomers = asyncHandler(async (_req: Request, res: Response) => {
  const customers = await store.listCustomers();
  res.json({ success: true, data: customers });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await store.createCustomer(parseCustomerInput(req.body));
  await invalidatePlan(store);
  res.status(201).json({ success: true, data: customer });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw notFound('ไม่พบข้อมูลลูกค้า');
  }
  const customer = await store.updateCustomer(id, parseCustomerInput(req.body));
  if (!customer) {
    throw notFound('ไม่พบข้อมูลลูกค้า');
  }
  await invalidatePlan(store);
  res.json({ success: true, data: customer });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    throw notFound('ไม่พบข้อมูลลูกค้า');
  }
  if (await store.customerHasOrders(id)) {
    throw conflict('ลูกค้ารายนี้มีออเดอร์อยู่ จึงลบไม่ได้');
  }
  const customer = await store.deleteCustomer(id);
  if (!customer) {
    throw notFound('ไม่พบข้อมูลลูกค้า');
  }
  await invalidatePlan(store);
  res.json({ success: true, data: customer });
});
