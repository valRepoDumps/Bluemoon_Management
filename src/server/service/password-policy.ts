export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt truncates passwords beyond 72 UTF-8 bytes

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a new password against the BlueMoon password policy.
 * Safe for both client and server execution.
 */
export function validatePasswordPolicy(password: string): PasswordValidationResult {
  if (!password || password.trim().length === 0) {
    return { valid: false, error: "Mật khẩu mới không được để trống." };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Mật khẩu mới phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`,
    };
  }

  const byteLength = new TextEncoder().encode(password).length;
  if (byteLength > PASSWORD_MAX_BYTES) {
    return {
      valid: false,
      error: `Mật khẩu mới không được vượt quá ${PASSWORD_MAX_BYTES} byte.`,
    };
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "Mật khẩu mới phải bao gồm cả chữ cái và chữ số.",
    };
  }

  return { valid: true };
}
