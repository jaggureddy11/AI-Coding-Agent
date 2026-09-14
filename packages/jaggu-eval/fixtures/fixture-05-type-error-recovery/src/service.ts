import { ApiClient } from './client.js';

export class ConsumerService {
  constructor(private client: ApiClient) {}

  async process(id: string): Promise<number> {
    const raw = await this.client.getRecord(id);
    // Assumes getRecord returns a string, using .length
    return raw.length;
  }
}
