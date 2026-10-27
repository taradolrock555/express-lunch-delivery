import type { Request, Response } from 'express';
import { store } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/errors';
import { getRiderTask as loadRiderTask } from '../services/routePlanner';

export const getRiders = asyncHandler(async (_req: Request, res: Response) => {
  const riders = await store.listRiders();
  res.json({ success: true, data: riders });
});

export const getRiderTask = asyncHandler(async (req: Request, res: Response) => {
  const jobCode = String(req.params.jobCode ?? '').trim();
  if (!jobCode) {
    throw badRequest('กรุณากรอกรหัสพนักงาน');
  }
  const task = await loadRiderTask(jobCode, store);
  res.json({ success: true, data: task });
});
