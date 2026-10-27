import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Customer, CustomerService } from '../services/customer.service';
import { Order, OrderDraft, OrderService, OrderStatus } from '../services/order.service';
import { Rider, RiderService } from '../services/rider.service';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-owner-dashboard',
  styleUrl: './owner-dashboard.component.css',
  templateUrl: './owner-dashboard.component.html',
})
export class OwnerDashboard implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly customerService = inject(CustomerService);
  private readonly riderService = inject(RiderService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly riders = signal<Rider[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly customerCount = computed(() => this.customers().length);
  protected readonly orderCount = computed(() => this.orders().length);
  protected readonly readyOrderCount = computed(
    () => this.orders().filter((order) => order.status === 'ready').length,
  );
  protected readonly totalBoxes = computed(() =>
    this.orders().reduce((total, order) => total + order.totalBoxes, 0),
  );
  protected readonly activeCustomerIds = computed(
    () =>
      new Set(
        this.orders()
          .filter((order) => this.isActiveStatus(order.status))
          .map((order) => order.customerId),
      ),
  );
  protected readonly hasAvailableCustomer = computed(() =>
    this.customers().some((customer) => !this.activeCustomerIds().has(customer.id)),
  );
  protected isSaving = false;
  protected editingOrderId: number | null = null;
  protected orderDraft: OrderDraft = {
    customerId: 1,
    riderId: null,
    totalBoxes: 1,
  };

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.loadOrders();
    this.loadCustomers();
    this.loadRiders();
  }

  protected loadOrders(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.orderService.getOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.syncDraftSelection();
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
        this.successMessage.set(
          editingId === null
            ? this.orderDraft.riderId === null
              ? 'เพิ่มออเดอร์แล้ว ระบบจะจัดไรเดอร์ให้อัตโนมัติตอนวางแผน'
              : 'เพิ่มออเดอร์และกำหนดไรเดอร์แล้ว'
            : 'แก้ไขออเดอร์แล้ว',
        );
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
    this.orderDraft = {
      customerId: order.customerId,
      riderId: order.assignmentMode === 'manual' ? order.riderId : null,
      totalBoxes: order.totalBoxes,
    };
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
    this.orderDraft = {
      customerId: this.firstAvailableCustomerId(),
      riderId: null,
      totalBoxes: 1,
    };
  }

  protected isCustomerBlocked(customerId: number): boolean {
    if (!this.activeCustomerIds().has(customerId)) {
      return false;
    }
    if (this.editingOrderId !== null) {
      const editingOrder = this.orders().find((order) => order.id === this.editingOrderId);
      return editingOrder?.customerId !== customerId;
    }
    return true;
  }

  protected isRiderUnavailable(rider: Rider): boolean {
    return rider.status !== 'available' || this.isRiderFull(rider.id);
  }

  protected isRiderFull(riderId: number): boolean {
    const count = this.orders().filter(
      (order) =>
        order.id !== this.editingOrderId &&
        order.riderId === riderId &&
        this.isActiveStatus(order.status) &&
        (order.assignmentMode === 'manual' || order.status === 'delivering'),
    ).length;
    return count >= 3;
  }

  protected activeOrderCountForRider(riderId: number): number {
    return this.orders().filter(
      (order) =>
        order.id !== this.editingOrderId &&
        order.riderId === riderId &&
        this.isActiveStatus(order.status) &&
        (order.assignmentMode === 'manual' || order.status === 'delivering'),
    ).length;
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
        this.syncDraftSelection();
      },
      error: (error: unknown) => {
        console.error('Failed to load customers for orders:', error);
        this.errorMessage.set('โหลดรายชื่อลูกค้าไม่สำเร็จ กรุณาตรวจสอบ Backend');
      },
    });
  }

  private loadRiders(): void {
    this.riderService.getRiders().subscribe({
      next: (riders) => {
        this.riders.set(riders);
        this.syncDraftSelection();
      },
      error: (error: unknown) => {
        console.error('Failed to load riders for orders:', error);
        this.errorMessage.set('โหลดรายชื่อไรเดอร์ไม่สำเร็จ กรุณาตรวจสอบ Backend');
      },
    });
  }

  private syncDraftSelection(): void {
    if (this.editingOrderId !== null) {
      return;
    }

    if (
      this.customers().length > 0 &&
      this.isCustomerBlocked(this.orderDraft.customerId)
    ) {
      this.orderDraft.customerId = this.firstAvailableCustomerId();
    }

    if (this.orderDraft.riderId !== null) {
      const selectedRider = this.riders().find((rider) => rider.id === this.orderDraft.riderId);
      if (
        selectedRider &&
        this.isRiderUnavailable(selectedRider)
      ) {
        this.orderDraft.riderId = null;
      }
    }
  }

  private firstAvailableCustomerId(): number {
    return this.customers().find((customer) => !this.isCustomerBlocked(customer.id))?.id ?? 0;
  }

  private isActiveStatus(status: OrderStatus): boolean {
    return status !== 'delivered' && status !== 'cancelled';
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
