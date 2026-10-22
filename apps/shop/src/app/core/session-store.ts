import { HttpClient } from '@angular/common/http';
import { afterNextRender, computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LAB_MODE } from '../lab/lab-mode';
import { UserId } from './profile.model';

interface Session {
  name: string;
  accessToken: string;
}

@Service()
export class SessionStore {
  private readonly http = inject(HttpClient);
  private readonly purgeOnSignOut = inject(LAB_MODE) === 'safe';
  private readonly session = signal<Session | null>(null);

  readonly name = computed(() => this.session()?.name ?? null);
  readonly accessToken = computed(() => this.session()?.accessToken ?? null);

  constructor() {
    // After hydration, so the server and the first client render match.
    afterNextRender(() => {
      const name = sessionStorage.getItem('name');
      const accessToken = sessionStorage.getItem('accessToken');
      this.session.set(name && accessToken ? { name, accessToken } : null);
    });
  }

  async signIn(user: UserId): Promise<void> {
    const session = await firstValueFrom(this.http.post<Session>('/api/session', { user }));
    this.remember(session);
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.delete('/api/session'));
    this.remember(null);
    if (this.purgeOnSignOut) {
      await purgeServiceWorkerData();
    }
  }

  private remember(session: Session | null) {
    this.session.set(session);
    if (session) {
      sessionStorage.setItem('name', session.name);
      sessionStorage.setItem('accessToken', session.accessToken);
    } else {
      sessionStorage.clear();
    }
  }
}

/** Lab 5: whatever the Service Worker cached for this user goes away with them. */
async function purgeServiceWorkerData(): Promise<void> {
  if (typeof caches === 'undefined') {
    return;
  }
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith('ngsw:') && name.includes(':data:'))
      .map((name) => caches.delete(name)),
  );
}
