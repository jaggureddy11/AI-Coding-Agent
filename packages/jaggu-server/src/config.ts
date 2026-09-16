import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function initDotenv(): void {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(process.cwd(), 'packages/jaggu-server/.env'),
    path.resolve(currentDir, '../.env'),
    path.resolve(currentDir, '../../.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
    }
  }

  // Fallback to default search
  dotenv.config();
}

initDotenv();

export interface ServerConfig {
  port: number;
  host: string;
  serverAuthSecret?: string;
  defaultProvider: string;
  keys: {
    huggingface?: string;
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
  ollamaBaseUrl: string;
}

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    serverAuthSecret: process.env.SERVER_AUTH_SECRET || undefined,
    defaultProvider: process.env.DEFAULT_PROVIDER || 'huggingface',
    keys: {
      huggingface: process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN,
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    },
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  };
}
