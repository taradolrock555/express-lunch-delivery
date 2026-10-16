import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type * as Leaflet from 'leaflet';
import { Customer, CustomerDraft, CustomerService } from '../services/customer.service';

@Component({
  imports: [FormsModule],
  selector: 'app-customer-management',
  styleUrl: './customer-management.component.css',
  templateUrl: './customer-management.component.html',
})
export class CustomerManagement implements OnInit, AfterViewInit, OnDestroy {
  private readonly customerService = inject(CustomerService);
  private customerMap?: Leaflet.Map;
  private customerMarker?: Leaflet.CircleMarker;
  private leafletModule?: Promise<typeof import('leaflet')>;
  private lastAddressSearchAt = 0;
  private destroyed = false;

  @ViewChild('customerMap')
  private customerMapElement?: ElementRef<HTMLDivElement>;

  protected readonly customers = signal<Customer[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly locationMessage = signal<string | null>(null);
  protected readonly isSearchingLocation = signal(false);
  protected isSaving = false;
  protected editingId: number | null = null;
  protected draft: CustomerDraft = this.emptyDraft();

  ngOnInit(): void {
    this.loadCustomers();
  }

  ngAfterViewInit(): void {
    const host = this.customerMapElement?.nativeElement;
    if (!host) {
      return;
    }
    void this.initializeMap(host).catch((error: unknown) => {
      console.error('Failed to load customer map:', error);
      this.locationMessage.set('โหลดแผนที่ไม่สำเร็จ กรุณาลองโหลดหน้าใหม่');
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.customerMap?.remove();
  }

  private async initializeMap(host: HTMLDivElement): Promise<void> {
    const L = await (this.leafletModule ??= import('leaflet'));
    if (this.destroyed) {
      return;
    }
    this.customerMap = L.map(host).setView([this.draft.latitude, this.draft.longitude], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.customerMap);
    this.customerMarker = L.circleMarker([this.draft.latitude, this.draft.longitude], {
      color: '#fff',
      fillColor: '#dc2626',
      fillOpacity: 1,
      radius: 9,
      weight: 3,
    }).addTo(this.customerMap);
    this.customerMap.on('click', (event: Leaflet.LeafletMouseEvent) => {
      this.setDraftCoordinates(event.latlng.lat, event.latlng.lng);
    });
    setTimeout(() => this.customerMap?.invalidateSize(), 0);
  }

  protected loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers) => this.customers.set(customers),
      error: (error: unknown) => {
        console.error('Failed to load customers:', error);
        this.errorMessage.set('โหลดข้อมูลลูกค้าไม่สำเร็จ กรุณาตรวจสอบ Backend');
      },
    });
  }

  protected saveCustomer(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSaving = true;
    const operation = this.editingId === null
      ? this.customerService.createCustomer({ ...this.draft })
      : this.customerService.updateCustomer(this.editingId, { ...this.draft });

    operation.subscribe({
      next: () => {
        this.successMessage.set(this.editingId === null ? 'เพิ่มข้อมูลลูกค้าแล้ว' : 'บันทึกข้อมูลลูกค้าแล้ว');
        this.cancelEdit();
        this.isSaving = false;
        this.loadCustomers();
      },
      error: (error: unknown) => {
        console.error('Failed to save customer:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง'));
        this.isSaving = false;
      },
    });
  }

  protected editCustomer(customer: Customer): void {
    this.editingId = customer.id;
    this.draft = {
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      latitude: customer.latitude,
      longitude: customer.longitude,
    };
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.locationMessage.set(null);
    this.updateCustomerMarker();
  }

  protected deleteCustomer(customer: Customer): void {
    if (!window.confirm(`ลบข้อมูลลูกค้า "${customer.name}" หรือไม่?`)) {
      return;
    }
    this.customerService.deleteCustomer(customer.id).subscribe({
      next: () => {
        this.successMessage.set('ลบข้อมูลลูกค้าแล้ว');
        this.errorMessage.set(null);
        this.loadCustomers();
      },
      error: (error: unknown) => {
        console.error('Failed to delete customer:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'ลบข้อมูลไม่สำเร็จ ลูกค้าที่มีออเดอร์จะลบไม่ได้'));
      },
    });
  }

  protected cancelEdit(): void {
    this.editingId = null;
    this.draft = this.emptyDraft();
    this.locationMessage.set(null);
    this.updateCustomerMarker();
  }

  protected updateCustomerMarker(): void {
    const latitude = Number(this.draft.latitude);
    const longitude = Number(this.draft.longitude);
    if (
      !this.customerMap ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return;
    }
    const position: Leaflet.LatLngExpression = [latitude, longitude];
    this.customerMarker?.setLatLng(position);
    this.customerMap.setView(position, Math.max(this.customerMap.getZoom(), 15));
  }

  protected setDraftCoordinates(latitude: number, longitude: number): void {
    this.draft.latitude = Number(latitude.toFixed(6));
    this.draft.longitude = Number(longitude.toFixed(6));
    this.customerMarker?.setLatLng([this.draft.latitude, this.draft.longitude]);
    this.locationMessage.set('เลือกพิกัดจากแผนที่แล้ว');
  }

  protected async searchAddress(): Promise<void> {
    const query = this.draft.address.trim();
    this.locationMessage.set(null);
    if (!query) {
      this.locationMessage.set('กรุณากรอกที่อยู่ก่อนค้นหา');
      return;
    }
    if (this.isSearchingLocation()) {
      return;
    }

    this.isSearchingLocation.set(true);
    try {
      const waitMs = Math.max(0, 1100 - (Date.now() - this.lastAddressSearchAt));
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastAddressSearchAt = Date.now();
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' }).toString();
      const response = await fetch(url, { headers: { 'Accept-Language': 'th,en' } });
      if (!response.ok) {
        throw new Error(`Nominatim request failed with status ${response.status}`);
      }
      const results: unknown = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        this.locationMessage.set('ไม่พบตำแหน่งจากที่อยู่นี้ ลองเพิ่มรายละเอียดที่อยู่');
        return;
      }
      const match = results[0];
      if (typeof match !== 'object' || match === null || !('lat' in match) || !('lon' in match)) {
        throw new Error('Nominatim returned an invalid result');
      }
      const latitude = Number(match.lat);
      const longitude = Number(match.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Nominatim returned invalid coordinates');
      }
      this.setDraftCoordinates(latitude, longitude);
      if ('display_name' in match && typeof match.display_name === 'string') {
        this.draft.address = match.display_name.slice(0, 255);
      }
      this.locationMessage.set('พบตำแหน่งแล้ว ตรวจสอบหมุดและพิกัดก่อนบันทึก');
    } catch (error) {
      console.error('Failed to search address with Nominatim:', error);
      this.locationMessage.set('ค้นหาที่อยู่ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      this.isSearchingLocation.set(false);
    }
  }

  protected mapUrl(customer: Customer): string {
    return `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`;
  }

  private emptyDraft(): CustomerDraft {
    return { name: '', phone: '', address: '', latitude: 16.2452, longitude: 103.2501 };
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
