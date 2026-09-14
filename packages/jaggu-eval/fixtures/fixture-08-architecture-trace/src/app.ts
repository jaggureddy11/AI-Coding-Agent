import { authMiddleware } from './middleware/auth.ts';

export function createApp() {
  return {
    routes: ['/api/login', '/api/secure'],
    middleware: [authMiddleware],
  };
}
