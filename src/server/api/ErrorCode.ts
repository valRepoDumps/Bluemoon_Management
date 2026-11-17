// Error Codes Specification from SDD / Backend Specs
export const ErrorCodes = {
  SUCCESS: 1000,
  VALIDATION_ERROR: 1001,
  INVALID_CREDENTIALS: 1002,
  UNAUTHENTICATED: 1003,
  FORBIDDEN: 1004,
  NOT_FOUND: 1005,
  DUPLICATE_OR_CONFLICT: 1006,
  BUSINESS_RULE_VIOLATION: 1007,
  SYSTEM_OR_DATABASE_ERROR: 9999,
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Main API Response structure containing ONLY code and data
export interface ApiResponse<T = Record<string, any>> {
  code: ErrorCode;
  data: T;
}