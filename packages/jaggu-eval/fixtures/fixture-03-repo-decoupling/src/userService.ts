import { executeQuery, UserRow } from './db/sqliteClient.ts';

export class UserService {
  // Direct coupling to database implementation
  getUser(id: string): UserRow | null {
    return executeQuery('SELECT * FROM users WHERE id = ?', [id]);
  }
}
