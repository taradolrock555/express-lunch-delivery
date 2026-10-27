import { Router } from 'express';
import { getGeoRoute } from '../controllers/geoController';

export const geoRoutes = Router();

geoRoutes.post('/route', getGeoRoute);
