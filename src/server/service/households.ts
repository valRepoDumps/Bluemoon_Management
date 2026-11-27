import type postgres from 'postgres';
import { getSessionUser } from '~/server/service/auth';
import type { Tx } from '~/server/database/seed-database-table';

/**
 * Service function to fetch households for a given request.
 * Throws an Error with message "Unauthenticated" when no valid session.
 */
export async function getHouseholdsForRequest(
  sql: Tx,
  request: Request,
): Promise<HouseholdView[]> {
  const session = await getSessionUser(sql, request);
  if (!session) {
    throw new Error('Unauthenticated');
  }

  const rows = await sql<Array<{
    household_id: string;
    number: string;
    status: string;
    head_id: string | null;
    resident_id: string | null;
    resident_name: string | null;
    phone_number: string | null;
    birth_date: string | null;
    relationship: string | null;
  }>>`
    SELECT
      h.id AS household_id,
      h.number,
      h.status,
      h.head_id,
      r.id AS resident_id,
      r.name AS resident_name,
      r.phone_number,
      TO_CHAR(r.birth_date, 'YYYY-MM-DD') AS birth_date,
      r.relationship
    FROM households h
    LEFT JOIN residents r ON r.household_id = h.id
    ORDER BY h.number, r.birth_date, r.id
  `;

  const byId = new Map<string, HouseholdView>();
  for (const row of rows) {
    let household = byId.get(row.household_id);
    if (!household) {
      household = {
        id: row.household_id,
        number: String(row.number),
        status: row.status,
        head: null,
        residents: [],
      };
      byId.set(row.household_id, household);
    }
    if (row.resident_id) {
      const resident: ResidentView = {
        id: row.resident_id,
        name: row.resident_name?.trim() || 'Chưa cập nhật tên',
        phoneNumber: row.phone_number,
        birthDate: row.birth_date ?? '',
        relationship: row.relationship ?? '',
      };
      household.residents.push(resident);
      if (row.head_id === row.resident_id) {
        household.head = resident;
      }
    }
  }
  return Array.from(byId.values());
}

/** Types used by both client and server */
export interface ResidentView {
  id: string;
  name: string;
  phoneNumber: string | null;
  birthDate: string;
  relationship: string;
}

export interface HouseholdView {
  id: string;
  number: string;
  status: string;
  head: ResidentView | null;
  residents: ResidentView[];
}
