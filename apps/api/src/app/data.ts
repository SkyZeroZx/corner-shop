export type UserId = 'ana' | 'beto';

export interface Profile {
  id: UserId;
  name: string;
  balance: number;
  points: number;
  address: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface Order {
  id: string;
  items: string[];
  total: number;
}

export interface Promo {
  id: string;
  title: string;
  /** Comes from the CMS. Editors can change it without a deploy. */
  trackUrl: string;
}

export const PROFILES: Record<UserId, Profile> = {
  ana: {
    id: 'ana',
    name: 'Ana Quispe',
    balance: 1250.4,
    points: 320,
    address: 'Av. Colonial 1450, Callao',
  },
  beto: {
    id: 'beto',
    name: 'Beto Ramirez',
    balance: 87.1,
    points: 15,
    address: 'Jr. Paz Soldan 155, La Perla',
  },
};

/** Own keys only: `PROFILES['constructor']` exists too, through the prototype. */
export const isUserId = (value: unknown): value is UserId =>
  typeof value === 'string' && Object.keys(PROFILES).includes(value);

export const ORDERS: Record<UserId, Order[]> = {
  ana: [
    { id: '#1042', items: ['Rice 5 kg', 'Chicha morada 1 L'], total: 34.5 },
    { id: '#1051', items: ['Ground coffee 250 g'], total: 18.9 },
  ],
  beto: [{ id: '#1043', items: ['Bread rolls x10'], total: 3 }],
};

export const PRODUCTS: Product[] = [
  { id: 'rice', name: 'Rice 5 kg', price: 21.9 },
  { id: 'milk', name: 'Evaporated milk 400 g', price: 4.2 },
  { id: 'chicha', name: 'Chicha morada 1 L', price: 6.5 },
  { id: 'bread', name: 'Bread rolls x10', price: 3 },
  { id: 'coffee', name: 'Ground coffee 250 g', price: 18.9 },
  { id: 'alfajores', name: 'Alfajores x6', price: 9.5 },
];

export const PROMOS: Promo[] = [
  {
    id: 'chicha',
    title: '2x1 Chicha morada',
    trackUrl: '/api/promos/chicha/save',
  },
  {
    // A compromised CMS account changed this one. One backslash, nothing else.
    id: 'alfajores',
    title: 'Alfajores -20%',
    trackUrl: '/\\localhost:9999/collect?promo=alfajores',
  },
];
