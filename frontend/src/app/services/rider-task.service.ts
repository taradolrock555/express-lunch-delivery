import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { RiderRoute, Location } from './route-planning.service';

export interface RiderTask extends RiderRoute {
  jobCode: string;
  rider: RiderRoute['rider'];
  shop: Location;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class RiderTaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/riders/tasks';

  getTask(jobCode: string): Observable<RiderTask> {
    return this.http.get<ApiResponse<RiderTask>>(`${this.apiUrl}/${encodeURIComponent(jobCode)}`).pipe(
      map((response) => {
        if (!response.success || !response.data) {
          throw new Error('The rider task API returned an invalid response.');
        }
        return response.data;
      }),
    );
  }
}
