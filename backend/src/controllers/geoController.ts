import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { normalizeCoordinates, requestOsrmRoute } from '../services/geo';

export const getGeoRoute = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const coordinates = normalizeCoordinates(body.coordinates);
  const route = await requestOsrmRoute(coordinates);
  res.json({ success: true, data: route });
});
