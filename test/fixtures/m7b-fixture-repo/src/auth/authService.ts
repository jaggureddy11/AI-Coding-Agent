export class AuthService {
  private activeTokens = new Set<string>();

  public createSession(userId: string): string {
    const token = `session_${userId}_${Date.now()}`;
    this.activeTokens.add(token);
    return token;
  }

  public validateSession(token: string): boolean {
    return this.activeTokens.has(token);
  }

  public revokeSession(token: string): void {
    this.activeTokens.delete(token);
  }
}
