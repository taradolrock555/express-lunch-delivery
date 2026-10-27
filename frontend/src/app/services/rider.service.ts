import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api.config';

export type RiderStatus = 'available' | 'unavailable';

export interface Rider {
  id: number;
  name: string;
  jobCode: string;
  status: RiderStatus;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class RiderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/riders`;

  getRiders(): Observable<Rider[]> {
    return this.http.get<ApiResponse<Rider[]>>(this.apiUrl).pipe(
      map((response) => {
        if (!response.success || !Array.isArray(response.data)) {
          throw new Error('The riders API returned an invalid response.');
        }
        return response.data;
      }),
    );
  }
}
