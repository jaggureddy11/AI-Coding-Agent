export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: unknown): ValidationResult {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be a string' };
  }
  if (username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Username length must be between 3 and 30 characters' };
  }
  if (username.includes('\0')) {
    return { valid: false, error: 'Username cannot contain null bytes' };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return { valid: false, error: 'Username contains invalid characters' };
  }
  return { valid: true };
}

export function validateAge(age: unknown): ValidationResult {
  if (typeof age !== 'number' || Number.isNaN(age)) {
    return { valid: false, error: 'Age must be a valid number' };
  }
  if (!Number.isInteger(age)) {
    return { valid: false, error: 'Age must be an integer' };
  }
  if (age < 0 || age > 130) {
    return { valid: false, error: 'Age must be between 0 and 130' };
  }
  return { valid: true };
}
