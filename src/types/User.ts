
export enum UserRole {
  ADMIN = "ADMIN",
  STAFF = "STAFF",
  MANAGER = "MANAGER"
}

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: string; // ISO timestamp string
  updatedAt: string; // ISO timestamp string
  deletedAt: string | null; // Nullable for soft deletes
}