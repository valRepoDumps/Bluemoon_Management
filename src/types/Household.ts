export type HouseholdStatus = "Active" | "Vacant";

export type HouseHoldID = number;
export type ResidentID = number;

export interface Household {
  household_id: HouseHoldID;
  headId: ResidentID; // Foreign key linking to Resident.id (head of household)
  number: string; // Apartment / household number
  status: HouseholdStatus;
}

export interface Resident {
  resident_id: ResidentID; // Primary key & Foreign key linking to User.id per schema
  householdId: HouseHoldID; // Foreign key linking to Household.id
  phoneNumber: string | null;
  birthDate: string; // YYYY-MM-DD
  relationship: string; // e.g., "Chủ hộ", "Vợ", "Con"
}

// Combined Apartment / Household View Object (useful for UI representation)
export interface ApartmentDetail extends Household {
  head: Resident;
  residents: Resident[];
}