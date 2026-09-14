export interface Request {
  ip: string;
  path: string;
  method: string;
}

export interface Response {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  status(code: number): this;
  json(data: unknown): this;
}

export type NextFunction = () => void;
export type Middleware = (req: Request, res: Response, next: NextFunction) => void;
