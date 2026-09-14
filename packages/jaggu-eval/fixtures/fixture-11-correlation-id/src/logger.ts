export class RequestLogger {
  private logs: Array<{ correlationId: string; message: string }> = [];

  log(correlationId: string, message: string): void {
    this.logs.push({ correlationId, message });
  }

  getLogs(): Array<{ correlationId: string; message: string }> {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

export const defaultLogger = new RequestLogger();
