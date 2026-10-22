import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { OriginCheck } from '../../core/origin-check';
import { Promo } from '../../core/promo.model';
import { SessionStore } from '../../core/session-store';

@Component({
  selector: 'app-promos',
  templateUrl: './promos.html',
  styleUrl: './promos.css',
})
export class Promos {
  private readonly http = inject(HttpClient);
  protected readonly check = inject(OriginCheck);
  protected readonly session = inject(SessionStore);
  protected readonly promos = httpResource<Promo[]>(() => '/api/promos');
  protected readonly status = signal('');

  protected save(promo: Promo) {
    this.http.post(promo.trackUrl, { promoId: promo.id }).subscribe({
      next: () => this.status.set(`Saved "${promo.title}".`),
      error: (error: HttpErrorResponse) =>
        this.status.set(`"${promo.title}" failed with ${error.status}.`),
    });
  }
}
