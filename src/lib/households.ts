import { query } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { getDb } from "~/server/database/db";
import { getSessionUser } from "~/server/service/auth";

/**
 * Types for household data.
 */
interface ResidentView {
  id: string;
  name: string;
  phoneNumber: string | null;
  birthDate: string;
  relationship: string;
}

interface HouseholdView {
  id: string;
  number: string;
  status: string;
  head: ResidentView | null;
  residents: ResidentView[];
}

/**
 * Server function to fetch household list.
 * Returns an array of HouseholdView. Throws on authentication errors.
 */
export const getHouseholdsQuery = query(async (): Promise<HouseholdView[]> => {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("No request event");
  const sql = getDb();
  const session = await getSessionUser(sql, event.request);
  if (!session) {
    // Mimic API response for unauthenticated
    throw new Error("Unauthenticated");
  }

  // Delegate fetching/processing to service function
  const { getHouseholdsForRequest } = await import("~/server/service/households");
  return await getHouseholdsForRequest(sql, event.request);
}, "households");
