import { verifyAuthHeader } from '../services/authService.ts';

export function authMiddleware(req: { headers: { authorization?: string } }): boolean {
  return verifyAuthHeader(req.headers.authorization);
}
