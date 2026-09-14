import { Request, Response } from '../server.js';

export function handleLogin(req: Request, res: Response): void {
  // Login handler
  res.status(200).json({ status: 'ok', user: 'authenticated' });
}
