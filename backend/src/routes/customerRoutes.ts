import { Router } from 'express';
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from '../controllers/customerController';

export const customerRoutes = Router();

customerRoutes.get('/', getCustomers);
customerRoutes.post('/', createCustomer);
customerRoutes.put('/:id', updateCustomer);
customerRoutes.delete('/:id', deleteCustomer);
