import type { UserDB, SessionDB, HouseholdDB, ResidentDB } from './DatabaseProp';
import { generateUUID } from '~/types/UUID';
import { UserRole } from '~/types/User';
import { HouseholdStatus } from '~/types/Household';
import { hashPasswordSync, verifyPasswordSync} from '../service/password-hash';
// 1. Generate every id once, up front, so records can reference each other
const ids = {
  users: { huong: generateUUID(), admin: generateUUID(), manager: generateUUID() },
  sessions: { huong: generateUUID() },
  households: { h1203: generateUUID(), h1204: generateUUID(), h1205: generateUUID() },
  residents: { r1: generateUUID(), r2: generateUUID(), r3: generateUUID() },
};

// 2. Annotate the type instead of using `as X[]`, so the compiler checks the data
export const mockUsers: UserDB[] = [
  {
    id: ids.users.huong,
    email: "nv.huong@bluemoon.com",
    passwordHash: hashPasswordSync("huong2000"),
    name: "Nguyễn Thị Hương",
    role: UserRole.STAFF,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    deletedAt: null,
  },
  {
    id: ids.users.admin,
    email: "admin@bluemoon.com",
    passwordHash: hashPasswordSync("bluemoon-min"),
    name: "Quản Trị Viên",
    role: UserRole.ADMIN,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    deletedAt: null,
  },
  {
    id: ids.users.manager,
    email: "manager@bluemoon.com",
    passwordHash: hashPasswordSync("bluemoon-man"),
    name: "Trần Văn Quản Lý",
    role: UserRole.MANAGER,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    deletedAt: null,
  },
];

export const mockSessions: SessionDB[] = [
  {
    id: ids.sessions.huong,
    userId: ids.users.huong,                 // -> mockUsers[0]
    token: "token_1_1763300000",
    createdAt: "2026-11-16T08:00:00Z",
    expiresAt: "2026-11-17T08:00:00Z",
  },
];

export const mockHouseholds: HouseholdDB[] = [
  {
    id: ids.households.h1203,
    headId: ids.residents.r1,                // -> resident in this household
    number: 1203,                          // was a number, must be a string
    status: HouseholdStatus.ACTIVE,
  },
  {
    id: ids.households.h1204,
    headId: ids.residents.r3,                // -> resident in this household
    number: 1204,
    status: HouseholdStatus.ACTIVE,
  },
  {
    id: ids.households.h1205,
    headId: null,                            // vacant, so no head
    number: 1205,
    status: HouseholdStatus.VACANT,
  },
];

export const mockResidents: ResidentDB[] = [
  {
    id: ids.residents.r1,
    householdId: ids.households.h1203,
    phoneNumber: "0912345678",
    birthDate: "1980-01-15",
    relationship: "Chủ hộ",
  },
  {
    id: ids.residents.r2,
    householdId: ids.households.h1203,
    phoneNumber: "0987654321",
    birthDate: "1985-06-20",
    relationship: "Vợ",
  },
  {
    id: ids.residents.r3,
    householdId: ids.households.h1204,
    phoneNumber: "0901122334",
    birthDate: "1975-11-10",
    relationship: "Chủ hộ",
  },
];

// Keeps seed.ts and the tests working unchanged
export const mockDatabase = {
  users: mockUsers,
  sessions: mockSessions,
  households: mockHouseholds,
  residents: mockResidents,
};