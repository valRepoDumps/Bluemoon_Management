import { ErrorCode } from  './ErrorCode';

// Main API Response structure containing ONLY code and data
export interface ApiResponse<T = Record<string, any>> {
  code: ErrorCode;
  data: T;
}