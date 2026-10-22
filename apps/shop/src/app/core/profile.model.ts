export type UserId = 'ana' | 'beto';

export interface Profile {
  id: UserId;
  name: string;
  balance: number;
  points: number;
  address: string;
}
