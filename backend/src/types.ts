export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export type RiderStatus = 'available' | 'unavailable';
export type RiderAssignmentMode = 'auto' | 'manual';

export type RouteStrategy = 'alternative' | 'nearest';

export type RouteOptimizationMethod =
  | 'local-search'
  | 'near-to-far round-robin'
  | 'far-to-near round-robin'
  | 'near-to-far grouped'
  | 'far-to-near grouped';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
}

export type CustomerInput = Omit<Customer, 'id'>;

export interface Rider {
  id: number;
  name: string;
  jobCode: string;
  status: RiderStatus;
}

export interface Order {
  id: number;
  customerId: number;
  riderId: number | null;
  assignmentMode: RiderAssignmentMode;
  totalBoxes: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderView extends Order {
  customerName: string;
  customerPhone: string;
  riderName: string | null;
  riderJobCode: string | null;
  pickupAddress: string;
  deliveryAddress: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Location {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Pricing {
  salePricePerBox: number;
  foodCostPerBox: number;
  riderFeePerTrip: number;
  riderCostPerKmPerBox: number;
  riderSpeedKmh: number;
  departureTime: string;
  deadlineTime: string;
  maxBoxesPerOrder: number;
  maxOrdersPerRider: number;
  maxCustomerDistanceKm: number;
  /** งบประมาณค่าส่งต่อวัน (บาท) */
  dailyDeliveryBudget: number;
  /** กำไรสุทธิขั้นต่ำที่ร้านต้องการต่อวัน (บาท) */
  targetProfit: number;
}

export interface RouteStop extends OrderView {
  sequenceNumber: number;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RiderRoute {
  rider: Rider;
  stops: RouteStop[];
  totalBoxes: number;
  geometry?: RouteGeometry;
  distanceSource: 'osrm' | 'haversine';
  distanceKm: number;
  travelMinutes: number;
  revenue: number;
  foodCost: number;
  deliveryCost: number;
  profit: number;
  estimatedArrival: string;
  meetsDeadline: boolean;
}

export interface RouteOptimizationComparison {
  method: RouteOptimizationMethod;
  distanceKm: number;
  deliveryCost: number;
}

export interface RouteTotals {
  totalBoxes: number;
  distanceKm: number;
  totalTravelMinutes: number;
  revenue: number;
  foodCost: number;
  deliveryCost: number;
  profit: number;
  allRoutesMeetDeadline: boolean;
  budget: number;
  overBudget: boolean;
  targetProfit: number;
  belowTargetProfit: boolean;
}

export interface RoutePlan {
  strategy: RouteStrategy;
  planDate: string;
  publishedAt: string;
  shop: Location;
  pricing: Pricing;
  optimizationSource?: 'osrm' | 'haversine';
  optimizationMethod?: RouteOptimizationMethod;
  optimizationComparisons?: RouteOptimizationComparison[];
  optimizationComparisonMethod?: 'route' | 'table';
  totals: RouteTotals;
  routes: RiderRoute[];
}

export interface RoutePlanRecord {
  plan: RoutePlan;
  publishedAt: string;
}

export interface RiderTask extends RiderRoute {
  jobCode: string;
  shop: Location;
  planDate: string;
  publishedAt: string;
  isToday: boolean;
}
