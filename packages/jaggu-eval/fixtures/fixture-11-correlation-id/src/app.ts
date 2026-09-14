import type { Request, Response, Middleware } from './http.ts';
import { defaultLogger } from './logger.ts';

export class App {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  handle(req: Request, res: Response, finalHandler: (req: Request, res: Response) => void): void {
    let index = 0;
    const next = () => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index++];
        mw(req, res, next);
      } else {
        defaultLogger.log(req.correlationId || 'UNKNOWN', `Handled ${req.method} ${req.path}`);
        finalHandler(req, res);
      }
    };
    next();
  }
}
