export interface Session {
  id: number;
  userId: number; // Foreign key linking to User.id
  token: string;
  createdAt: string; // ISO timestamp string
  expiresAt: string; // ISO timestamp string
}