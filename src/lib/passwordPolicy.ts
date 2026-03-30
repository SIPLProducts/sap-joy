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
 * Pure JS SHA-256 fallback for non-secure contexts (HTTP).
 */
function sha256JS(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
  const maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);
  const sigma0 = (x: number) => rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
  const sigma1 = (x: number) => rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
  const gamma0 = (x: number) => rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
  const gamma1 = (x: number) => rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);

  const bytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push(192 | (c >> 6)); bytes.push(128 | (c & 63)); }
    else { bytes.push(224 | (c >> 12)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)); }
  }

  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 56; i >= 0; i -= 8) bytes.push((bitLen / Math.pow(2, i)) & 0xff);

  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const W: number[] = [];
    for (let i = 0; i < 16; i++)
      W[i] = (bytes[offset + i * 4] << 24) | (bytes[offset + i * 4 + 1] << 16) | (bytes[offset + i * 4 + 2] << 8) | bytes[offset + i * 4 + 3];
    for (let i = 16; i < 64; i++)
      W[i] = (gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16]) | 0;

    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 64; i++) {
      const t1 = (h + sigma1(e) + ch(e, f, g) + K[i] + W[i]) | 0;
      const t2 = (sigma0(a) + maj(a, b, c)) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(v => (v >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Hash a password for history comparison (NOT for auth).
 * Uses a pure JS SHA-256 implementation so it works consistently on
 * self-hosted HTTP deployments where Web Crypto may be unavailable.
 */
export async function hashPasswordForHistory(password: string): Promise<string> {
  const salted = password + 'mrb_pw_salt_v1';
  return sha256JS(salted);
}
