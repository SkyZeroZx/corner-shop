import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed } from '@angular/core';
import { Deal } from '../../core/deal.model';

@Component({
  selector: 'app-deals',
  imports: [DecimalPipe],
  templateUrl: './deals.html',
  styleUrl: './deals.css',
})
export class Deals {
  protected readonly deals = httpResource<Deal[]>(() => '/api/deals/today');
  protected readonly reason = computed(() => explain(this.deals.error()));
}

function explain(error: unknown): string {
  return error instanceof HttpErrorResponse && error.status !== 0
    ? `The API answered ${error.status}.`
    : 'The API answered with a redirect, and calls to our API do not follow redirects.';
}
