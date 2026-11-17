
export interface UserDB {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: "ADMIN" | "STAFF" | "MANAGER";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SessionDB {
  id: number;
  userId: number;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface HouseholdDB {
  id: number;
  headId: number | null;
  number: string; // Apartment number
  status: "Active" | "Vacant";
}

export interface ResidentDB {
  id: number;
  householdId: number;
  phoneNumber: string | null;
  birthDate: string;
  relationship: string;
}