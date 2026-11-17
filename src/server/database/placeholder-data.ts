import {UserDB, SessionDB, HouseholdDB, ResidentDB} from './DatabaseProp'

// Complete mock data store matching the SDD database schema
export const mockDatabase = {
  users: [
    {
      id: 1,
      email: "nv.huong@bluemoon.com",
      passwordHash: "hashed_Bluemoon#2026",
      name: "Nguyễn Thị Hương",
      role: "STAFF",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      deletedAt: null,
    },
    {
      id: 2,
      email: "admin@bluemoon.com",
      passwordHash: "hashed_Bluemoon#2026",
      name: "Quản Trị Viên",
      role: "ADMIN",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      deletedAt: null,
    },
    {
      id: 3,
      email: "manager@bluemoon.com",
      passwordHash: "hashed_Bluemoon#2026",
      name: "Trần Văn Quản Lý",
      role: "MANAGER",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      deletedAt: null,
    },
  ] as UserDB[],

  sessions: [
    {
      id: 101,
      userId: 1,
      token: "token_1_1763300000",
      createdAt: "2026-11-16T08:00:00Z",
      expiresAt: "2026-11-17T08:00:00Z",
    },
  ] as SessionDB[],

  households: [
    {
      id: 101,
      headId: 10,
      number: "1203",
      status: "Active",
    },
    {
      id: 102,
      headId: 11,
      number: "1204",
      status: "Active",
    },
    {
      id: 103,
      headId: 12,
      number: "1205",
      status: "Vacant",
    },
  ] as HouseholdDB[],

  residents: [
    {
      id: 10,
      householdId: 101,
      phoneNumber: "0912345678",
      birthDate: "1980-01-15",
      relationship: "Chủ hộ",
    },
    {
      id: 11,
      householdId: 101,
      phoneNumber: "0987654321",
      birthDate: "1985-06-20",
      relationship: "Vợ",
    },
    {
      id: 12,
      householdId: 102,
      phoneNumber: "0901122334",
      birthDate: "1975-11-10",
      relationship: "Chủ hộ",
    },
  ] as ResidentDB[],
};