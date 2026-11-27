import {UUID} from '../../types/UUID'
import { UserRole } from '~/types/User';
import { HouseholdStatus } from '~/types/Household';
import { HouseHoldID } from '~/types/Ids';

export interface ObjDB {
  id: UUID
}

export interface UserDB extends ObjDB{
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SessionDB extends ObjDB{
  userId: UUID;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface HouseholdDB extends ObjDB{
  headId: UUID | null;
  number: number; // Apartment number
  status: HouseholdStatus;
}

export interface ResidentDB extends ObjDB{
  householdId: HouseHoldID;
  name: string;
  phoneNumber: string | null;
  birthDate: string;
  relationship: string;
}