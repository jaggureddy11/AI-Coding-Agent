export interface ClientConfig {
  baseUrl: string;
}

export class ApiClient {
  constructor(private config: ClientConfig) {}

  // Initial signature returns a plain string
  async getRecord(id: string): Promise<string> {
    return `record_${id}_payload`;
  }
}
