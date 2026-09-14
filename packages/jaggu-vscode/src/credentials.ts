import * as vscode from 'vscode';

export class CredentialManager {
  private static readonly SECRET_PREFIX = 'jaggu.apiKey.';

  constructor(private readonly _secrets: vscode.SecretStorage) {}

  public async getApiKey(providerId: string): Promise<string | undefined> {
    if (providerId === 'mock' || providerId === 'ollama') {
      return undefined; // No key required
    }
    return this._secrets.get(`${CredentialManager.SECRET_PREFIX}${providerId}`);
  }

  public async setApiKey(providerId: string, apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      await this.deleteApiKey(providerId);
    } else {
      await this._secrets.store(`${CredentialManager.SECRET_PREFIX}${providerId}`, trimmed);
    }
  }

  public async deleteApiKey(providerId: string): Promise<void> {
    await this._secrets.delete(`${CredentialManager.SECRET_PREFIX}${providerId}`);
  }

  public getActiveProvider(): string {
    const config = vscode.workspace.getConfiguration('jaggu');
    return config.get<string>('provider', 'mock');
  }

  public getActiveModel(): string {
    const config = vscode.workspace.getConfiguration('jaggu');
    return config.get<string>('model', '');
  }

  public getOllamaBaseUrl(): string {
    const config = vscode.workspace.getConfiguration('jaggu');
    return config.get<string>('ollamaBaseUrl', 'http://localhost:11434');
  }

  public getTemperature(): number {
    const config = vscode.workspace.getConfiguration('jaggu');
    return config.get<number>('temperature', 0.2);
  }
}
