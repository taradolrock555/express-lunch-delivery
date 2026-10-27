import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
}

export type CustomerDraft = Omit<Customer, 'id'>;

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/customers`;

  getCustomers(): Observable<Customer[]> {
    return this.http.get<ApiResponse<Customer[]>>(this.apiUrl).pipe(
      map((response) => this.unwrap(response)),
    );
  }

  createCustomer(draft: CustomerDraft): Observable<Customer> {
    return this.http.post<ApiResponse<Customer>>(this.apiUrl, draft).pipe(
      map((response) => this.unwrap(response)),
    );
  }

  updateCustomer(id: number, draft: CustomerDraft): Observable<Customer> {
    return this.http.put<ApiResponse<Customer>>(`${this.apiUrl}/${id}`, draft).pipe(
      map((response) => this.unwrap(response)),
    );
  }

  deleteCustomer(id: number): Observable<Customer> {
    return this.http.delete<ApiResponse<Customer>>(`${this.apiUrl}/${id}`).pipe(
      map((response) => this.unwrap(response)),
    );
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success || response.data === undefined) {
      throw new Error('The customers API returned an invalid response.');
    }
    return response.data;
  }
}
