export interface Request {
  headers: Record<string, string | undefined>;
  path: string;
  method: string;
  correlationId?: string;
}

export interface Response {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
  setHeader(name: string, value: string): void;
  status(code: number): this;
  json(data: unknown): void;
}

export type NextFunction = (err?: any) => void;
export type Middleware = (req: Request, res: Response, next: NextFunction) => void;
