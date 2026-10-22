import { DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { Product } from '../../core/product.model';
import { Profile } from '../../core/profile.model';

@Component({
  selector: 'app-home',
  imports: [DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly me = httpResource<Profile>(() => '/api/me');
  protected readonly products = httpResource<Product[]>(() => '/api/products');
}
