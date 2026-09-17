import { JagguProxyServer } from './server.js';
import { loadConfig } from './config.js';

export * from './config.js';
export * from './server.js';
export * from './router.js';
export * from './types/schema.js';
export * from './handlers/chatHandler.js';

async function main() {
  const config = loadConfig();
  const server = new JagguProxyServer(config);

  try {
    const { port, host } = await server.start();
    console.log(`\n======================================================`);
    console.log(`🚀 JAGGU LLM Backend Proxy Server running!`);
    console.log(`📍 Endpoint: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/v1`);
    console.log(`💓 Health:   http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`);
    console.log(`🔑 Server-side keys loaded for:`);
    console.log(`   - Hugging Face: ${config.keys.huggingface ? '✅ Configured' : '❌ Not set'}`);
    console.log(`   - OpenAI:       ${config.keys.openai ? '✅ Configured' : '❌ Not set'}`);
    console.log(`   - Anthropic:    ${config.keys.anthropic ? '✅ Configured' : '❌ Not set'}`);
    console.log(`   - Gemini:       ${config.keys.gemini ? '✅ Configured' : '❌ Not set'}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Failed to start JAGGU proxy server:', err);
    process.exit(1);
  }
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// If invoked as entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

