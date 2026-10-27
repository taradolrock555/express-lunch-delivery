import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type * as Leaflet from 'leaflet';
import {
  RouteOptimizationMethod,
  RoutePlan,
  RoutePlanningService,
  RouteStrategy,
  RiderRoute,
} from '../services/route-planning.service';

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
  protected readonly isPublishing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly strategy = signal<RouteStrategy>('alternative');
  protected readonly publishedAt = signal<string | null>(null);
  // The assignment allows up to 10 riders (30 orders / 3 orders per rider),
  // so keep a distinct, easy-to-see colour for every possible rider.
  protected readonly routeColors = [
    '#dc2626',
    '#16a34a',
    '#eab308',
    '#2563eb',
    '#9333ea',
    '#0891b2',
    '#db2777',
    '#ea580c',
    '#0f766e',
    '#4f46e5',
  ];

  ngAfterViewInit(): void {
    this.scheduleMapRender();
  }

  ngOnInit(): void {
    this.loadPublishedAt();
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
    this.loadPlan(this.strategy());
  }

  protected compare(strategy: RouteStrategy): void {
    if (this.strategy() === strategy) {
      return;
    }
    this.loadPlan(strategy);
  }

  protected publish(): void {
    this.isPublishing.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.routePlanningService.publish(this.strategy()).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.publishedAt.set(plan.publishedAt);
        this.isPublishing.set(false);
        this.successMessage.set(
          'เผยแพร่แผนแล้ว — ไรเดอร์สามารถใช้รหัสพนักงานเพื่อดูงานของตัวเองได้',
        );
        this.scheduleMapRender();
      },
      error: (error: unknown) => {
        console.error('Failed to publish delivery routes:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'เผยแพร่แผนไม่สำเร็จ'));
        this.isPublishing.set(false);
      },
    });
  }

  private loadPublishedAt(): void {
    this.routePlanningService.getCurrent().subscribe({
      next: (plan) => this.publishedAt.set(plan.publishedAt),
      error: () => {
        // ยังไม่เคยเผยแพร่แผน — ไม่ต้องแสดง error ให้รบกวนหน้าจอ
      },
    });
  }

  protected loadPlan(strategy: RouteStrategy): void {
    this.strategy.set(strategy);
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.routePlanningService.preview(strategy).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.isLoading.set(false);
        this.scheduleMapRender();
      },
      error: (error: unknown) => {
        console.error('Failed to calculate delivery routes:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'คำนวณเส้นทางไม่สำเร็จ'));
        this.isLoading.set(false);
      },
    });
  }

  protected colorForRoute(index: number): string {
    return this.routeColors[index % this.routeColors.length];
  }

  protected strategyLabel(strategy: RouteStrategy): string {
    return strategy === 'nearest' ? 'เรียงจุดใกล้ก่อน' : 'แผนประหยัดต้นทุน';
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

  protected formatDateTime(value: string | null): string {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  protected totalStops(route: RiderRoute): number {
    return route.stops.length;
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
      this.map = L.map(this.mapHost).setView(
        [plan.shop.latitude, plan.shop.longitude],
        14,
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(this.map);
      this.routeLayer = L.layerGroup().addTo(this.map);
    }

    this.routeLayer?.clearLayers();
    const bounds = L.latLngBounds([[plan.shop.latitude, plan.shop.longitude]]);

    plan.routes.forEach((route, routeIndex) => {
      const color = this.colorForRoute(routeIndex);
      const geometry = route.geometry?.coordinates.map(([longitude, latitude]) =>
        L.latLng(latitude, longitude),
      );
      const coordinates = geometry?.length
        ? geometry
        : [
            L.latLng(plan.shop.latitude, plan.shop.longitude),
            ...route.stops.map((stop) => L.latLng(stop.latitude, stop.longitude)),
          ];

      L.polyline(coordinates, { color, weight: 5, opacity: 0.85 }).addTo(
        this.routeLayer!,
      );
      coordinates.forEach((coordinate) => bounds.extend(coordinate));
      route.stops.forEach((stop) => {
        L.circleMarker([stop.latitude, stop.longitude], {
          color: '#fff',
          fillColor: color,
          fillOpacity: 1,
          radius: 9,
          weight: 2,
        })
          .bindTooltip(
            `${stop.sequenceNumber}. ${stop.customerName} · ${stop.totalBoxes} กล่อง`,
          )
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
      if (
        typeof apiError === 'object' &&
        apiError !== null &&
        'message' in apiError &&
        typeof apiError.message === 'string'
      ) {
        return apiError.message;
      }
    }
    return fallback;
  }
}
