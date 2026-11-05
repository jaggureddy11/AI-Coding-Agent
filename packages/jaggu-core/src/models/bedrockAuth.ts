import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentityProvider } from '@aws-sdk/types';

export interface BedrockAuthOptions {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  profile?: string;
}

/**
 * Resolves AWS region using explicit option, environment variable, ~/.aws/config, or sensible default.
 */
export function resolveBedrockRegion(options?: BedrockAuthOptions): string {
  if (options?.region && options.region.trim()) {
    return options.region.trim();
  }
  if (process.env.AWS_REGION && process.env.AWS_REGION.trim()) {
    return process.env.AWS_REGION.trim();
  }
  if (process.env.AWS_DEFAULT_REGION && process.env.AWS_DEFAULT_REGION.trim()) {
    return process.env.AWS_DEFAULT_REGION.trim();
  }

  // Inspect ~/.aws/config for default profile region
  try {
    const configPath = path.join(os.homedir(), '.aws', 'config');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const match = content.match(/region\s*=\s*([a-z0-9-]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {
    // Ignore file read errors
  }

  return 'us-east-1';
}

/**
 * Resolves credential provider chain for AWS Bedrock.
 * Prioritizes explicit credentials if provided, then falls back to AWS default chain
 * (environment variables, AWS SSO / credentials file, IAM role).
 */
export function resolveBedrockCredentials(
  options?: BedrockAuthOptions,
):
  | AwsCredentialIdentityProvider
  | { accessKeyId: string; secretAccessKey: string; sessionToken?: string } {
  if (options?.accessKeyId && options?.secretAccessKey) {
    return {
      accessKeyId: options.accessKeyId.trim(),
      secretAccessKey: options.secretAccessKey.trim(),
      sessionToken: options.sessionToken?.trim(),
    };
  }

  // AWS SDK standard credential provider chain
  return fromNodeProviderChain({
    profile: options?.profile || process.env.AWS_PROFILE,
  });
}
