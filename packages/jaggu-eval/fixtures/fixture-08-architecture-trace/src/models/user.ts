export interface UserAccount {
  id: string;
  role: string;
}

const users: Map<string, UserAccount> = new Map([
  ['user123', { id: 'user123', role: 'admin' }],
]);

export function findUserById(id: string): UserAccount | null {
  return users.get(id) || null;
}
