export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export class UserRepository {
  private users: Map<string, User> = new Map();

  public save(user: User): void {
    this.users.set(user.id, user);
  }

  public findByUsername(username: string): User | undefined {
    for (const u of this.users.values()) {
      if (u.username === username) return u;
    }
    return undefined;
  }

  public findByEmail(email: string): User | undefined {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return undefined;
  }

  public count(): number {
    return this.users.size;
  }
}
