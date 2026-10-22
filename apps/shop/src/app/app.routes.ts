import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

export const routes: Routes = [
  { path: '', title: 'Corner Shop', component: Home },
  {
    path: 'promos',
    title: 'Promos · Corner Shop',
    loadComponent: () => import('./pages/promos/promos').then((m) => m.Promos),
  },
  {
    path: 'deals',
    title: 'Deals · Corner Shop',
    loadComponent: () => import('./pages/deals/deals').then((m) => m.Deals),
  },
  {
    path: 'orders',
    title: 'Orders · Corner Shop',
    loadComponent: () => import('./pages/orders/orders').then((m) => m.Orders),
  },
  {
    path: 'login',
    title: 'Sign in · Corner Shop',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  { path: '**', redirectTo: '' },
];
