export interface OrderHistory {
  owner: string;
  orders: { id: string; items: string[]; total: number }[];
}
