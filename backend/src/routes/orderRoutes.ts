import { Router } from 'express';
import {
  createOrder,
  deleteOrder,
  getOrders,
  updateOrder,
} from '../controllers/orderController';

export const orderRoutes = Router();

orderRoutes.get('/', getOrders);
orderRoutes.post('/', createOrder);
orderRoutes.put('/:id', updateOrder);
orderRoutes.delete('/:id', deleteOrder);
