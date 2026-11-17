import { ErrorCode } from  './ErrorCode';

// Main API Response structure containing ONLY code and data
export class ApiResponse<T> {
  constructor(
    public code: ErrorCode,
    public data: T
  ) {}

  toJSON(): string {
    return JSON.stringify({
      code: this.code,
      data: this.data,
    });
  }
}