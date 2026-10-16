import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export type RouteStrategy = 'nearest' | 'alternative';
export type RouteOptimizationMethod =
  | 'local-search'
  | 'near-to-far round-robin'
  | 'far-to-near round-robin'
  | 'near-to-far grouped'
  | 'far-to-near grouped';

export interface RouteOptimizationComparison {
  method: RouteOptimizationMethod;
  distanceKm: number;
  deliveryCost: number;
}

export interface Location {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface RouteStop {
  id: number;
  customerId: number;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
  totalBoxes: number;
  sequenceNumber: number;
}

export interface RiderRoute {
  rider: { id: number; name: string; jobCode: string; status: string };
  stops: RouteStop[];
  totalBoxes: number;
  geometry?: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  distanceSource?: 'osrm' | 'haversine';
  distanceKm: number;
  travelMinutes: number;
  revenue: number;
  foodCost: number;
  deliveryCost: number;
  profit: number;
  estimatedArrival: string;
  meetsDeadline: boolean;
}

export interface RoutePlan {
  strategy: RouteStrategy;
  optimizationSource?: 'osrm' | 'haversine';
  optimizationMethod?: RouteOptimizationMethod;
  optimizationComparisonMethod?: 'route' | 'table';
  optimizationComparisons?: RouteOptimizationComparison[];
  shop: Location;
  pricing: {
    departureTime: string;
    deadlineTime: string;
    maxBoxesPerOrder: number;
    maxOrdersPerRider: number;
  };
  totals: {
    totalBoxes: number;
    distanceKm: number;
    revenue: number;
    foodCost: number;
    deliveryCost: number;
    profit: number;
    allRoutesMeetDeadline: boolean;
  };
  routes: RiderRoute[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class RoutePlanningService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/routes';

  preview(strategy: RouteStrategy): Observable<RoutePlan> {
    return this.http.post<ApiResponse<RoutePlan>>(`${this.apiUrl}/preview`, { strategy }).pipe(
      map((response) => {
        if (!response.success || !response.data) {
          throw new Error('The route planning API returned an invalid response.');
        }
        return response.data;
      }),
    );
  }
}
