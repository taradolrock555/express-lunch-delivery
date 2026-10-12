import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OrderService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(OrderService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('requests orders from the backend and returns the response data', () => {
    const mockOrders = [
      {
        id: 1,
        customerName: 'Somchai',
        pickupAddress: 'Restaurant',
        deliveryAddress: 'Office',
        status: 'pending' as const,
      },
    ];

    service.getOrders().subscribe((orders) => {
      expect(orders).toEqual(mockOrders);
    });

    const request = httpTesting.expectOne('http://localhost:3000/api/orders');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: mockOrders });
  });
});
