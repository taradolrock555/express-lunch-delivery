import { Router } from 'express';
import {
  getPublishedRoutes,
  previewRoutes,
  publishRoutes,
} from '../controllers/routeController';

export const routeRoutes = Router();

routeRoutes.post('/preview', previewRoutes);
routeRoutes.post('/publish', publishRoutes);
routeRoutes.get('/current', getPublishedRoutes);
