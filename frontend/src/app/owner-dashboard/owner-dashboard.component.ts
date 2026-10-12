import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Customer, CustomerService } from '../services/customer.service';
import { Order, OrderDraft, OrderService, OrderStatus } from '../services/order.service';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-owner-dashboard',
  styleUrl: './owner-dashboard.component.css',
  templateUrl: './owner-dashboard.component.html',
})
export class OwnerDashboard implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly customerService = inject(CustomerService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected isSaving = false;
  protected editingOrderId: number | null = null;
  protected orderDraft: OrderDraft = { customerId: 1, totalBoxes: 1 };

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.loadOrders();
    this.loadCustomers();
  }

  protected loadOrders(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.orderService.getOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Failed to load orders:', error);
        this.errorMessage.set('โหลดรายการออเดอร์ไม่สำเร็จ กรุณาตรวจสอบ Backend แล้วลองอีกครั้ง');
        this.isLoading.set(false);
      },
    });
  }

  protected saveOrder(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isSaving = true;
    const editingId = this.editingOrderId;
    const operation = editingId === null
      ? this.orderService.createOrder({ ...this.orderDraft })
      : this.orderService.updateOrder(editingId, { ...this.orderDraft });

    operation.subscribe({
      next: () => {
        this.successMessage.set(editingId === null ? 'เพิ่มออเดอร์แล้ว' : 'แก้ไขออเดอร์แล้ว');
        this.cancelEdit();
        this.isSaving = false;
        this.loadOrders();
      },
      error: (error: unknown) => {
        console.error('Failed to save order:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'บันทึกออเดอร์ไม่สำเร็จ กรุณาตรวจสอบข้อมูล'));
        this.isSaving = false;
      },
    });
  }

  protected editOrder(order: Order): void {
    this.editingOrderId = order.id;
    this.orderDraft = { customerId: order.customerId, totalBoxes: order.totalBoxes };
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }

  protected deleteOrder(order: Order): void {
    if (!window.confirm(`ลบออเดอร์ #${order.id} หรือไม่?`)) {
      return;
    }
    this.orderService.deleteOrder(order.id).subscribe({
      next: () => {
        this.successMessage.set(`ลบออเดอร์ #${order.id} แล้ว`);
        this.errorMessage.set(null);
        this.loadOrders();
      },
      error: (error: unknown) => {
        console.error('Failed to delete order:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'ลบออเดอร์ไม่สำเร็จ'));
      },
    });
  }

  protected updateStatus(order: Order, status: OrderStatus): void {
    this.orderService.updateOrder(order.id, { status }).subscribe({
      next: () => {
        this.successMessage.set(`เปลี่ยนสถานะออเดอร์ #${order.id} แล้ว`);
        this.errorMessage.set(null);
        this.loadOrders();
      },
      error: (error: unknown) => {
        console.error('Failed to update order status:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'เปลี่ยนสถานะออเดอร์ไม่สำเร็จ'));
      },
    });
  }

  protected cancelEdit(): void {
    this.editingOrderId = null;
    this.orderDraft = { customerId: this.customers()[0]?.id ?? 1, totalBoxes: 1 };
  }

  protected statusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      pending: 'รอดำเนินการ',
      preparing: 'กำลังเตรียม',
      ready: 'พร้อมจัดส่ง',
      delivering: 'กำลังจัดส่ง',
      delivered: 'จัดส่งแล้ว',
      cancelled: 'ยกเลิก',
    };

    return labels[status];
  }

  protected statusClass(status: OrderStatus): string {
    return `status-${status.replace('_', '-')}`;
  }

  private loadCustomers(): void {
    this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.customers.set(customers);
        if (this.editingOrderId === null && customers.length > 0) {
          this.orderDraft.customerId = customers[0].id;
        }
      },
      error: (error: unknown) => {
        console.error('Failed to load customers for orders:', error);
        this.errorMessage.set('โหลดรายชื่อลูกค้าไม่สำเร็จ กรุณาตรวจสอบ Backend');
      },
    });
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
