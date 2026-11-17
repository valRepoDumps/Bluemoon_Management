import {UUID} from '../service/UUID'
export interface ObjDB {
  id: UUID
}

export interface UserDB extends ObjDB{
  email: string;
  passwordHash: string;
  name: string;
  role: "ADMIN" | "STAFF" | "MANAGER";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SessionDB extends ObjDB{
  userId: number;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface HouseholdDB extends ObjDB{
  headId: number | null;
  number: string; // Apartment number
  status: "Active" | "Vacant";
}

export interface ResidentDB extends ObjDB{
  householdId: number;
  phoneNumber: string | null;
  birthDate: string;
  relationship: string;
}