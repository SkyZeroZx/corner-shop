import { Component, inject } from '@angular/core';
import { SessionStore } from '../../core/session-store';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  protected readonly session = inject(SessionStore);
}
