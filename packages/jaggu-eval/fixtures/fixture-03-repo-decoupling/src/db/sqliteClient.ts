export interface UserRow {
  id: string;
  name: string;
  email: string;
}

const mockDatabaseTable: Map<string, UserRow> = new Map([
  ['u1', { id: 'u1', name: 'Alice', email: 'alice@example.com' }],
  ['u2', { id: 'u2', name: 'Bob', email: 'bob@example.com' }],
]);

export function executeQuery(query: string, params: string[]): UserRow | null {
  if (query.includes('SELECT * FROM users WHERE id = ?')) {
    return mockDatabaseTable.get(params[0]) || null;
  }
  return null;
}
