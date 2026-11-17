import {SessionID, UserID} from './Ids';

export interface Session {
  id: SessionID;
  userId: UserID; // Foreign key linking to User.id
  token: string;
  createdAt: string; // ISO timestamp string
  expiresAt: string; // ISO timestamp string
}