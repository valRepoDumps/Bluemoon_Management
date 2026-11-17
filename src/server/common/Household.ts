export type HouseholdStatus = "Active" | "Vacant";

export interface Household {
  id: number;
  headId: number; // Foreign key linking to Resident.id (head of household)
  number: string; // Apartment / household number
  status: HouseholdStatus;
}

export interface Resident {
  id: number; // Primary key & Foreign key linking to User.id per schema
  householdId: number; // Foreign key linking to Household.id
  phoneNumber: string | null;
  birthDate: string; // YYYY-MM-DD
  relationship: string; // e.g., "Chủ hộ", "Vợ", "Con"
}

// Combined Apartment / Household View Object (useful for UI representation)
export interface ApartmentDetail extends Household {
  head: Resident;
  residents: Resident[];
}