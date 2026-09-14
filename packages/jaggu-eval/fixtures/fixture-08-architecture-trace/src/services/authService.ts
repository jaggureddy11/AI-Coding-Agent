import { parseToken } from '../crypto/token.ts';
import { findUserById } from '../models/user.ts';

export function verifyAuthHeader(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  const parsed = parseToken(token);
  if (!parsed) return false;
  const user = findUserById(parsed.userId);
  return user !== null;
}
