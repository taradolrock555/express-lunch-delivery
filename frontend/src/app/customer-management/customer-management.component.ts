import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Customer, CustomerDraft, CustomerService } from '../services/customer.service';

@Component({
  imports: [FormsModule],
  selector: 'app-customer-management',
  styleUrl: './customer-management.component.css',
  templateUrl: './customer-management.component.html',
})
export class CustomerManagement implements OnInit {
  private readonly customerService = inject(CustomerService);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected isSaving = false;
  protected editingId: number | null = null;
  protected draft: CustomerDraft = this.emptyDraft();

  ngOnInit(): void {
    this.loadCustomers();
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
