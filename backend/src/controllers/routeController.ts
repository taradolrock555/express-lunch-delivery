import type { Request, Response } from 'express';
import { store } from '../db';
import { asyncHandler } from '../utils/asyncHandler';
import { asEnum } from '../utils/validate';
import type { RouteStrategy } from '../types';
import {
  computePlan,
  getCurrentPlan,
  publishPlan,
} from '../services/routePlanner';

const strategies: readonly RouteStrategy[] = ['alternative', 'nearest'];

function readStrategy(body: unknown): RouteStrategy {
  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return input.strategy === undefined
    ? 'alternative'
    : asEnum(input.strategy, strategies, 'กลยุทธ์การวางแผน');
}

export const previewRoutes = asyncHandler(async (req: Request, res: Response) => {
  const plan = await computePlan(readStrategy(req.body), store);
  res.json({ success: true, data: plan });
});

export const publishRoutes = asyncHandler(async (req: Request, res: Response) => {
  const plan = await publishPlan(readStrategy(req.body), store);
  res.json({ success: true, data: plan });
});

export const getPublishedRoutes = asyncHandler(async (_req: Request, res: Response) => {
  const plan = await getCurrentPlan(store);
  res.json({ success: true, data: plan });
});
