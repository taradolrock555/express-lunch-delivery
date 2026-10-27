import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RiderTask, RiderTaskService } from '../services/rider-task.service';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-rider-tasks',
  styleUrl: './rider-tasks.component.css',
  templateUrl: './rider-tasks.component.html',
})
export class RiderTasks {
  private readonly riderTaskService = inject(RiderTaskService);

  protected readonly task = signal<RiderTask | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly copyMessage = signal<string | null>(null);
  protected readonly todayLabel = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  protected jobCode = 'JOB-001';

  protected findTask(): void {
    const jobCode = this.jobCode.trim();
    this.task.set(null);
    this.errorMessage.set(null);
    this.copyMessage.set(null);
    if (!jobCode) {
      this.errorMessage.set('กรุณากรอกรหัสพนักงาน');
      return;
    }

    this.isLoading.set(true);
    this.riderTaskService.getTask(jobCode).subscribe({
      next: (task) => {
        this.task.set(task);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Failed to load rider task:', error);
        this.errorMessage.set(this.apiErrorMessage(error, 'ค้นหาใบงานไม่สำเร็จ กรุณาลองอีกครั้ง'));
        this.isLoading.set(false);
      },
    });
  }

  protected mapsUrl(task: RiderTask): string {
    const destination = task.stops[task.stops.length - 1] ?? task.shop;
    const waypoints = task.stops
      .slice(0, -1)
      .map((stop) => `${stop.latitude},${stop.longitude}`)
      .join('|');
    const params = new URLSearchParams({
      api: '1',
      origin: `${task.shop.latitude},${task.shop.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      travelmode: 'driving',
    });
    if (waypoints) {
      params.set('waypoints', waypoints);
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  protected stopMapUrl(latitude: number, longitude: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  protected routeSequence(task: RiderTask): string {
    return task.stops
      .map((stop) => `จุดที่ ${stop.sequenceNumber} ${stop.customerName}`)
      .join(' → ');
  }

  protected formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected formatPlanDate(value: string): string {
    const date = new Date(`${value}T00:00:00+07:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('th-TH', {
      dateStyle: 'long',
      timeZone: 'Asia/Bangkok',
    });
  }

  protected async copyMapsUrl(task: RiderTask): Promise<void> {
    const url = this.mapsUrl(task);
    try {
      await navigator.clipboard.writeText(url);
      this.copyMessage.set('คัดลอกลิงก์แผนที่แล้ว นำไปเปิดในแอปแผนที่ได้เลย');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.copyMessage.set('คัดลอกลิงก์แผนที่แล้ว นำไปเปิดในแอปแผนที่ได้เลย');
    }
    setTimeout(() => this.copyMessage.set(null), 3500);
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
