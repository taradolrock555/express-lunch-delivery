import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoutePlan, RoutePlanningService, RouteStrategy, RiderRoute } from '../services/route-planning.service';

@Component({
  imports: [CommonModule],
  selector: 'app-route-planning',
  styleUrl: './route-planning.component.css',
  templateUrl: './route-planning.component.html',
})
export class RoutePlanning implements OnInit {
  private readonly routePlanningService = inject(RoutePlanningService);

  protected readonly plan = signal<RoutePlan | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly strategy = signal<RouteStrategy>('nearest');
  protected readonly routeColors = ['#dc2626', '#16a34a', '#2563eb', '#9333ea', '#ea580c'];

  ngOnInit(): void {
    this.loadPlan('nearest');
  }

  protected recalculate(): void {
    this.loadPlan(this.strategy() === 'nearest' ? 'alternative' : 'nearest');
  }

  protected loadPlan(strategy: RouteStrategy): void {
    this.strategy.set(strategy);
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.routePlanningService.preview(strategy).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Failed to calculate mock routes:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'คำนวณเส้นทางจำลองไม่สำเร็จ'));
        this.isLoading.set(false);
      },
    });
  }

  protected colorForRoute(index: number): string {
    return this.routeColors[index % this.routeColors.length];
  }

  protected routePolyline(route: RiderRoute): string {
    const plan = this.plan();
    if (!plan) {
      return '';
    }
    return [
      this.mapPoint(plan.shop.latitude, plan.shop.longitude),
      ...route.stops.map((stop) => this.mapPoint(stop.latitude, stop.longitude)),
    ].map(({ x, y }) => `${x},${y}`).join(' ');
  }

  protected mapPoint(latitude: number, longitude: number): { x: number; y: number } {
    const plan = this.plan();
    const locations = plan
      ? [plan.shop, ...plan.routes.flatMap((route) => route.stops)]
      : [];
    const latitudes = locations.map((location) => location.latitude);
    const longitudes = locations.map((location) => location.longitude);
    const minLatitude = Math.min(...latitudes, latitude);
    const maxLatitude = Math.max(...latitudes, latitude);
    const minLongitude = Math.min(...longitudes, longitude);
    const maxLongitude = Math.max(...longitudes, longitude);
    const latitudeRange = maxLatitude - minLatitude || 0.001;
    const longitudeRange = maxLongitude - minLongitude || 0.001;

    return {
      x: 70 + ((longitude - minLongitude) / longitudeRange) * 860,
      y: 50 + ((maxLatitude - latitude) / latitudeRange) * 390,
    };
  }

  private apiErrorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const apiError = error.error;
      if (typeof apiError === 'object' && apiError !== null && 'message' in apiError && typeof apiError.message === 'string') {
        return apiError.message;
      }
    }
    return fallback;
  }
}
