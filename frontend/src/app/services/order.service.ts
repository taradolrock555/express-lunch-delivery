import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: number;
  customerId: number;
  riderId: number | null;
  assignmentMode: 'auto' | 'manual';
  customerName: string;
  customerPhone: string;
  riderName: string | null;
  riderJobCode: string | null;
  totalBoxes: number;
  pickupAddress: string;
  deliveryAddress: string;
  status: OrderStatus;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export interface OrderDraft {
  customerId: number;
  riderId: number | null;
  totalBoxes: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/orders`;

  getOrders(): Observable<Order[]> {
    return this.http.get<ApiResponse<Order[]>>(this.apiUrl).pipe(
      map((response) => {
        if (!response.success || !Array.isArray(response.data)) {
          throw new Error('The orders API returned an invalid response.');
        }

        return response.data;
      }),
    );
  }

  createOrder(draft: OrderDraft): Observable<Order> {
    return this.http.post<ApiResponse<Order>>(this.apiUrl, draft).pipe(
      map((response) => this.unwrap(response)),
    );
  }

  updateOrder(
    id: number,
    draft: Partial<OrderDraft> & { status?: OrderStatus },
  ): Observable<Order> {
    return this.http.put<ApiResponse<Order>>(`${this.apiUrl}/${id}`, draft).pipe(
      map((response) => this.unwrap(response)),
    );
  }

  deleteOrder(id: number): Observable<void> {
    return this.http.delete<ApiResponse<Order>>(`${this.apiUrl}/${id}`).pipe(
      map((response) => {
        this.unwrap(response);
      }),
    );
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success || response.data === undefined) {
      throw new Error('The orders API returned an invalid response.');
    }

    return response.data;
  }
}
