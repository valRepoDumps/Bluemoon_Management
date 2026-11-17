import { HouseHoldID, FeeID, DonationID } from "./Ids";

export interface Donation {
    donation_id: DonationID;
    name: string;
    start_date: string;
    end_date: string;
}

export interface Fee {
    fee_id: FeeID;
    household_id: HouseHoldID;
    fee_name: string;
    amount_due: number;
    due_date: string;
}   