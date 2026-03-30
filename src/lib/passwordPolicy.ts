/**
 * Password Policy Configuration
 * 
 * Rules:
 * 1. Must contain at least one letter and one number
 * 2. Minimum 8 characters
 * 3. Maximum 10 characters
 * 4. Password History: Last 3 passwords maintained
 * 5. Password Reuse: Last 4 passwords restricted from reuse
 * 6. Password Expiry: 45 days
 * 7. Failed Login Attempts: 5 attempts before account lock (30 min lockout)
 */

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 10,
  historyCount: 3,
  reuseRestriction: 4,
  expiryDays: 45,
  maxFailedAttempts: 5,
};

export const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,10}$/;

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }

  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_POLICY.maxLength} characters`);
  }

  if (!/[a-zA-Z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getPasswordStrengthIndicators(password: string) {
  return {
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
    meetsMinLength: password.length >= PASSWORD_POLICY.minLength,
    withinMaxLength: password.length <= PASSWORD_POLICY.maxLength,
  };
}

/**
 * Hash a password for history comparison (NOT for auth).
 * Uses SHA-256 with a fixed salt for deterministic comparison.
 */
export async function hashPasswordForHistory(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'mrb_pw_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
