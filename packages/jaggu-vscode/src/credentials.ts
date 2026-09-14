import * as vscode from 'vscode';

export class CredentialManager {
  private static readonly SECRET_PREFIX = 'jaggu.apiKey.';

  constructor(private readonly _secrets: vscode.SecretStorage) {}

  public async getApiKey(providerId: string): Promise<string | undefined> {
    if (providerId === 'mock' || providerId === 'ollama' || providerId === 'openai-compatible') {
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

  public async setActiveProvider(providerId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('jaggu');
    await config.update('provider', providerId, vscode.ConfigurationTarget.Global);
  }

  public getActiveModel(): string {
    const config = vscode.workspace.getConfiguration('jaggu');
    return config.get<string>('model', 'mock-fast');
  }

  public async setActiveModel(modelId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('jaggu');
    await config.update('model', modelId, vscode.ConfigurationTarget.Global);
  }

  public getOllamaBaseUrl(): string {
    const config = vscode.workspace.getConfiguration('jaggu');
    return (
      config.get<string>('ollama.endpoint') ||
      config.get<string>('ollamaBaseUrl') ||
      'http://localhost:11434'
    );
  }

  public getOpenAICompatibleBaseUrl(): string {
    const config = vscode.workspace.getConfiguration('jaggu');
    return config.get<string>('openaiCompatible.endpoint', 'http://localhost:1234/v1');
  }

  public getContextLimitOverride(): number {
    const config = vscode.workspace.getConfiguration('jaggu');
    return config.get<number>('model.contextLimit', 0);
  }

  public getTemperature(): number {
    const config = vscode.workspace.getConfiguration('jaggu');
    return config.get<number>('temperature', 0.2);
  }
}
