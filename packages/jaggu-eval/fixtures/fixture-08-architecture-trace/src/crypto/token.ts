export interface ParsedToken {
  userId: string;
  scope: string;
}

export function parseToken(rawToken: string): ParsedToken | null {
  if (!rawToken || rawToken.length < 5) return null;
  // Format: token_<userId>_<scope>
  const parts = rawToken.split('_');
  if (parts.length < 3 || parts[0] !== 'token') return null;
  return {
    userId: parts[1],
    scope: parts[2],
  };
}
