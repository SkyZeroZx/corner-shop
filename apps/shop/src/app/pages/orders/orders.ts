import { DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { OrderHistory } from '../../core/order-history.model';

@Component({
  selector: 'app-orders',
  imports: [DecimalPipe],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders {
  protected readonly orders = httpResource<OrderHistory>(() => '/api/orders');
}
