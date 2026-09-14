export interface JwtPayload {
  sub: string;
  exp: number;
}

export interface VerifyOptions {
  clockToleranceSec?: number;
}

export function verifyToken(payload: JwtPayload, nowSec: number, options: VerifyOptions = {}): boolean {
  // BUG: Clock skew/tolerance option is ignored, causing tokens evaluated with slight clock skew to fail
  if (nowSec > payload.exp) {
    return false;
  }
  return true;
}
