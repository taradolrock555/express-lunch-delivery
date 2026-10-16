import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type * as Leaflet from 'leaflet';
import { RouteOptimizationMethod, RoutePlan, RoutePlanningService, RouteStrategy, RiderRoute } from '../services/route-planning.service';

@Component({
  imports: [CommonModule],
  selector: 'app-route-planning',
  styleUrl: './route-planning.component.css',
  templateUrl: './route-planning.component.html',
})
export class RoutePlanning implements OnInit, AfterViewInit, OnDestroy {
  private readonly routePlanningService = inject(RoutePlanningService);
  private map?: Leaflet.Map;
  private routeLayer?: Leaflet.LayerGroup;
  private leafletModule?: Promise<typeof import('leaflet')>;
  private mapHost?: HTMLDivElement;
  private renderTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  @ViewChild('routeMap')
  set routeMapElement(element: ElementRef<HTMLDivElement> | undefined) {
    this.mapHost = element?.nativeElement;
    if (this.mapHost && this.plan()) {
      this.scheduleMapRender();
    }
  }

  protected readonly plan = signal<RoutePlan | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly strategy = signal<RouteStrategy>('alternative');
  protected readonly routeColors = ['#dc2626', '#16a34a', '#2563eb', '#9333ea', '#ea580c'];

  ngAfterViewInit(): void {
    this.scheduleMapRender();
  }

  ngOnInit(): void {
    this.loadPlan('alternative');
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    this.map?.remove();
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
        this.scheduleMapRender();
      },
      error: (error: unknown) => {
        console.error('Failed to calculate delivery routes:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'คำนวณเส้นทางจำลองไม่สำเร็จ'));
        this.isLoading.set(false);
      },
    });
  }

  protected colorForRoute(index: number): string {
    return this.routeColors[index % this.routeColors.length];
  }

  protected optimizationMethodLabel(method: RouteOptimizationMethod | undefined): string {
    switch (method) {
      case 'near-to-far round-robin':
        return 'ใกล้ไปไกล · สลับไรเดอร์';
      case 'far-to-near round-robin':
        return 'ไกลไปใกล้ · สลับไรเดอร์';
      case 'near-to-far grouped':
        return 'ใกล้ไปไกล · จัดเป็นกลุ่ม';
      case 'far-to-near grouped':
        return 'ไกลไปใกล้ · จัดเป็นกลุ่ม';
      case 'local-search':
      default:
        return 'ปรับกลุ่มและลำดับอัตโนมัติ';
    }
  }

  private scheduleMapRender(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    this.renderTimer = setTimeout(() => {
      this.renderMap().catch((error: unknown) => {
        console.error('Failed to load route map:', error);
        this.errorMessage.set('โหลดแผนที่ไม่สำเร็จ กรุณาลองโหลดหน้าใหม่');
      });
    }, 0);
  }

  private async renderMap(): Promise<void> {
    const plan = this.plan();
    if (!this.mapHost || !plan) {
      return;
    }
    const L = await (this.leafletModule ??= import('leaflet'));
    if (this.destroyed || !this.mapHost) {
      return;
    }

    if (!this.map) {
      this.map = L.map(this.mapHost).setView([plan.shop.latitude, plan.shop.longitude], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(this.map);
      this.routeLayer = L.layerGroup().addTo(this.map);
    }

    this.routeLayer?.clearLayers();
    const bounds = L.latLngBounds([[plan.shop.latitude, plan.shop.longitude]]);

    plan.routes.forEach((route, routeIndex) => {
      const color = this.colorForRoute(routeIndex);
      const geometry = route.geometry?.coordinates.map(
        ([longitude, latitude]) => L.latLng(latitude, longitude),
      );
      const coordinates = geometry?.length
        ? geometry
        : [
            L.latLng(plan.shop.latitude, plan.shop.longitude),
            ...route.stops.map((stop) => L.latLng(stop.latitude, stop.longitude)),
          ];

      L.polyline(coordinates, { color, weight: 5, opacity: 0.85 }).addTo(this.routeLayer!);
      coordinates.forEach((coordinate) => bounds.extend(coordinate));
      route.stops.forEach((stop, stopIndex) => {
        L.circleMarker([stop.latitude, stop.longitude], {
          color: '#fff',
          fillColor: color,
          fillOpacity: 1,
          radius: 9,
          weight: 2,
        })
          .bindTooltip(`${stopIndex + 1}. ${stop.customerName}`)
          .addTo(this.routeLayer!);
      });
    });

    L.circleMarker([plan.shop.latitude, plan.shop.longitude], {
      color: '#fff',
      fillColor: '#172033',
      fillOpacity: 1,
      radius: 10,
      weight: 3,
    })
      .bindTooltip(`ร้าน: ${plan.shop.name}`)
      .addTo(this.routeLayer!);

    this.map.invalidateSize();
    this.map.fitBounds(bounds.pad(0.15), { maxZoom: 15 });
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
