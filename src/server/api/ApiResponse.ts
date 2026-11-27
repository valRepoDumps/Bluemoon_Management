import { ErrorCode } from './ErrorCode';

export class ApiResponse<T> {
  constructor(
    public code: ErrorCode,
    public data: T
  ) {}

  toJSON(): { code: ErrorCode; data: T } {
    return {
      code: this.code,
      data: this.data,
    };
  }
}