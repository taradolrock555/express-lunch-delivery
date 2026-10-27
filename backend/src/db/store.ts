import type {
  Customer,
  CustomerInput,
  Order,
  RiderAssignmentMode,
  OrderStatus,
  Rider,
  RoutePlan,
} from '../types';

export interface OrderUpdate {
  customerId?: number;
  riderId?: number | null;
  assignmentMode?: RiderAssignmentMode;
  totalBoxes?: number;
  status?: OrderStatus;
}

export interface ActiveOrderFilter {
  customerId?: number;
  riderId?: number;
  excludeOrderId?: number;
  pinnedRiderOnly?: boolean;
}

export interface Store {
  init(): Promise<void>;
  reset(): Promise<void>;

  listCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | null>;
  createCustomer(input: CustomerInput): Promise<Customer>;
  updateCustomer(id: number, input: CustomerInput): Promise<Customer | null>;
  deleteCustomer(id: number): Promise<Customer | null>;
  customerHasOrders(customerId: number): Promise<boolean>;

  listOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | null>;
  createOrder(customerId: number, totalBoxes: number, riderId: number | null): Promise<Order>;
  updateOrder(id: number, update: OrderUpdate): Promise<Order | null>;
  deleteOrder(id: number): Promise<Order | null>;
  countActiveOrders(filter: ActiveOrderFilter): Promise<number>;

  listRiders(): Promise<Rider[]>;
  getRider(id: number): Promise<Rider | null>;
  getRiderByJobCode(jobCode: string): Promise<Rider | null>;

  getRoutePlan(): Promise<RoutePlan | null>;
  saveRoutePlan(
    plan: RoutePlan,
    assignments?: Array<{ orderId: number; riderId: number }>,
  ): Promise<void>;
  clearRoutePlan(): Promise<void>;
}
