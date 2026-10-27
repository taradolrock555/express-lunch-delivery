import { Router } from 'express';
import { getRiders, getRiderTask } from '../controllers/riderController';

export const riderRoutes = Router();

riderRoutes.get('/', getRiders);
riderRoutes.get('/tasks/:jobCode', getRiderTask);
