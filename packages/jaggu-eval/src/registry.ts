import { BenchmarkTaskDefinition } from './types.js';

export const BENCHMARK_TASKS: BenchmarkTaskDefinition[] = [
  // TASK-01: FEATURE
  {
    taskId: 'TASK-01',
    name: 'Authentication Rate Limiting',
    archetype: 'FEATURE',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-01-rate-limiter',
    prompt: 'Implement a sliding-window authentication rate limiter, wire it into the relevant Express authentication routes, and add unit tests.',
    expectedFilesModified: ['src/middleware/rateLimiter.ts', 'src/routes/auth.ts', 'test/rateLimiter.test.ts'],
    forbiddenFilesModified: ['src/store/memoryStore.ts', 'package.json'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Implement sliding-window rate limiter middleware, update auth routes, and add tests',
        steps: [
          {
            id: 'step-1',
            description: 'Create sliding-window rate limiter middleware using memoryStore',
            newFiles: ['src/middleware/rateLimiter.ts'],
          },
          {
            id: 'step-2',
            description: 'Wire rate limiter into auth routes to protect login endpoint',
            files: ['src/routes/auth.ts'],
          },
          {
            id: 'step-3',
            description: 'Add unit tests for rate limiter window expiration and thresholds',
            newFiles: ['test/rateLimiter.test.ts'],
          },
        ],
        risks: ['False positives on legitimate bursts'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/middleware/rateLimiter.ts',
          proposedContent: `import { Request, Response, NextFunction, Middleware } from '../server.js';
import { defaultStore } from '../store/memoryStore.js';

export function createRateLimiter(maxHits: number, windowMs: number): Middleware {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const hits = defaultStore.getHits(req.ip, windowMs, now);
    if (hits >= maxHits) {
      res.status(429).json({ error: 'Too Many Requests' });
      return;
    }
    defaultStore.recordHit(req.ip, now);
    next();
  };
}

export const rateLimiter = createRateLimiter(5, 60000);
`,
          isNewFile: true,
        },
        {
          relativePath: 'src/routes/auth.ts',
          proposedContent: `import { Request, Response } from '../server.ts';
import { rateLimiter } from '../middleware/rateLimiter.ts';

export const authMiddlewares = [rateLimiter];

export function handleLogin(req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', user: 'authenticated' });
}
`,
          isNewFile: false,
        },
        {
          relativePath: 'test/rateLimiter.test.ts',
          proposedContent: `import assert from 'assert';
import { createRateLimiter } from '../src/middleware/rateLimiter.ts';
import { defaultStore } from '../src/store/memoryStore.ts';

defaultStore.reset();
const limiter = createRateLimiter(2, 1000);
let nextCalled = 0;
const next = () => { nextCalled++; };
const mockReq = { ip: '127.0.0.1', path: '/auth', method: 'POST' };
const mockRes = {
  statusCode: 200,
  headers: {},
  body: '',
  status(c: number) { this.statusCode = c; return this; },
  json(d: unknown) { this.body = JSON.stringify(d); return this; },
};

limiter(mockReq, mockRes, next);
limiter(mockReq, mockRes, next);
assert.strictEqual(nextCalled, 2, 'First 2 requests should pass');
limiter(mockReq, mockRes, next);
assert.strictEqual(mockRes.statusCode, 429, 'Third request should be rate limited');
`,
          isNewFile: true,
        },
      ],
    },
  },

  // TASK-02: DEBUG
  {
    taskId: 'TASK-02',
    name: 'JWT Expiration Clock Skew',
    archetype: 'DEBUG',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-02-jwt-clockskew',
    prompt: 'Diagnose and fix the JWT expiration clock-skew problem without modifying the existing test file.',
    expectedFilesModified: ['src/jwtVerifier.ts'],
    forbiddenFilesModified: ['test/jwt.test.js'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Fix clock skew handling in JWT verifier without modifying test files',
        steps: [
          {
            id: 'step-1',
            description: 'Update verifyToken to respect options.clockToleranceSec',
            files: ['src/jwtVerifier.ts'],
          },
        ],
        risks: ['Tokens might be accepted slightly beyond expiration window if tolerance is too large'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/jwtVerifier.ts',
          proposedContent: `export interface JwtPayload {
  sub: string;
  exp: number;
}

export interface VerifyOptions {
  clockToleranceSec?: number;
}

export function verifyToken(payload: JwtPayload, nowSec: number, options: VerifyOptions = {}): boolean {
  const tolerance = options.clockToleranceSec ?? 0;
  // Apply clock skew leeway: token is only expired if nowSec exceeds (exp + tolerance)
  if (nowSec > payload.exp + tolerance) {
    return false;
  }
  return true;
}
`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-03: REFACTOR
  {
    taskId: 'TASK-03',
    name: 'Repository Decoupling',
    archetype: 'REFACTOR',
    difficulty: 'HARD',
    fixtureDir: 'fixture-03-repo-decoupling',
    prompt: 'Extract database access behind an interface/adapter so the service is decoupled from the database implementation, while preserving existing behavior.',
    expectedFilesModified: ['src/interfaces/IUserRepository.ts', 'src/adapters/SqliteUserRepository.ts', 'src/userService.ts'],
    forbiddenFilesModified: ['test/userService.test.js'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Decouple UserService by introducing IUserRepository and SqliteUserRepository',
        steps: [
          {
            id: 'step-1',
            description: 'Create IUserRepository interface',
            newFiles: ['src/interfaces/IUserRepository.ts'],
          },
          {
            id: 'step-2',
            description: 'Create SqliteUserRepository implementing IUserRepository',
            newFiles: ['src/adapters/SqliteUserRepository.ts'],
          },
          {
            id: 'step-3',
            description: 'Refactor UserService to depend on IUserRepository via dependency injection',
            files: ['src/userService.ts'],
          },
        ],
        risks: ['Breaking backwards compatibility for existing UserService callers if default repository is not provided'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/interfaces/IUserRepository.ts',
          proposedContent: `export interface UserRow {
  id: string;
  name: string;
  email: string;
}

export interface IUserRepository {
  findById(id: string): UserRow | null;
}
`,
          isNewFile: true,
        },
        {
          relativePath: 'src/adapters/SqliteUserRepository.ts',
          proposedContent: `import { executeQuery, type UserRow } from '../db/sqliteClient.ts';
import type { IUserRepository } from '../interfaces/IUserRepository.ts';

export class SqliteUserRepository implements IUserRepository {
  findById(id: string): UserRow | null {
    return executeQuery('SELECT * FROM users WHERE id = ?', [id]);
  }
}
`,
          isNewFile: true,
        },
        {
          relativePath: 'src/userService.ts',
          proposedContent: `import type { UserRow, IUserRepository } from './interfaces/IUserRepository.ts';
import { SqliteUserRepository } from './adapters/SqliteUserRepository.ts';

export class UserService {
  private repository: IUserRepository;

  constructor(repository?: IUserRepository) {
    this.repository = repository || new SqliteUserRepository();
  }

  getUser(id: string): UserRow | null {
    return this.repository.findById(id);
  }
}
`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-04: TEST GENERATION
  {
    taskId: 'TASK-04',
    name: 'Boundary Validation Tests',
    archetype: 'TESTGEN',
    difficulty: 'EASY',
    fixtureDir: 'fixture-04-boundary-validation',
    prompt: 'Inspect the validation logic and create a comprehensive unit-test suite covering malformed input, null bytes, boundary values, oversized values, and invalid types.',
    expectedFilesModified: ['test/validator.boundary.test.js'],
    forbiddenFilesModified: ['src/validator.ts'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Generate comprehensive boundary unit test suite for validator module',
        steps: [
          {
            id: 'step-1',
            description: 'Create boundary test suite test/validator.boundary.test.js with edge cases',
            newFiles: ['test/validator.boundary.test.js'],
          },
        ],
        risks: ['None (pure test addition)'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'test/validator.boundary.test.js',
          proposedContent: `import assert from 'assert';
import { validateUsername, validateAge } from '../src/validator.ts';

console.log('Running generated boundary test suite...');

// 1. Null byte check
const nullByte = validateUsername('admin\\0hack');
assert.strictEqual(nullByte.valid, false, 'Null byte in username must be rejected');

// 2. Length boundary: min (3) and max (30)
assert.strictEqual(validateUsername('ab').valid, false, 'Length < 3 must fail');
assert.strictEqual(validateUsername('abc').valid, true, 'Length = 3 must pass');
assert.strictEqual(validateUsername('a'.repeat(30)).valid, true, 'Length = 30 must pass');
assert.strictEqual(validateUsername('a'.repeat(31)).valid, false, 'Length = 31 must fail');

// 3. Non-string types
assert.strictEqual(validateUsername(null).valid, false, 'null username must fail');
assert.strictEqual(validateUsername(12345).valid, false, 'number username must fail');

// 4. Age boundaries: min (0), max (130), negative, non-integer
assert.strictEqual(validateAge(0).valid, true, 'Age 0 must pass');
assert.strictEqual(validateAge(130).valid, true, 'Age 130 must pass');
assert.strictEqual(validateAge(-1).valid, false, 'Negative age must fail');
assert.strictEqual(validateAge(131).valid, false, 'Age > 130 must fail');
assert.strictEqual(validateAge(25.5).valid, false, 'Float age must fail');
assert.strictEqual(validateAge('30').valid, false, 'String age must fail');

console.log('PASS: All boundary tests executed cleanly.');
process.exit(0);
`,
          isNewFile: true,
        },
      ],
    },
  },

  // TASK-05: CODE INTELLIGENCE (LSP Diagnostic Recovery)
  {
    taskId: 'TASK-05',
    name: 'Type Error Recovery',
    archetype: 'CODE_INTEL',
    difficulty: 'HARD',
    fixtureDir: 'fixture-05-type-error-recovery',
    prompt: 'Update the API signature and resolve all resulting downstream type errors without weakening type safety.',
    expectedFilesModified: ['src/client.ts', 'src/service.ts'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
      approveRepairs: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Update ApiClient signature to return structured RecordResult and resolve downstream type mismatches',
        steps: [
          {
            id: 'step-1',
            description: 'Update ApiClient.getRecord signature in src/client.ts',
            files: ['src/client.ts'],
          },
          {
            id: 'step-2',
            description: 'Update ConsumerService in src/service.ts to handle the structured object',
            files: ['src/service.ts'],
          },
        ],
        risks: ['Downstream consumer breaking on raw string assumptions'],
        verification: 'npm test',
      },
      // Initial edit only updates client.ts, which intentionally triggers a compiler diagnostic error on service.ts!
      edits: [
        {
          relativePath: 'src/client.ts',
          proposedContent: `export interface ClientConfig {
  baseUrl: string;
}

export interface RecordResult {
  id: string;
  data: string;
}

export class ApiClient {
  constructor(private config: ClientConfig) {}

  // Updated signature returns structured RecordResult
  async getRecord(id: string): Promise<RecordResult> {
    return { id, data: \`record_\${id}_payload\` };
  }
}
`,
          isNewFile: false,
        },
      ],
      // Diagnostic repair updates service.ts to resolve the diagnostic error
      diagnosticRepairs: [
        {
          relativePath: 'src/service.ts',
          proposedContent: `import { ApiClient } from './client.ts';

export class ConsumerService {
  constructor(private client: ApiClient) {}

  async process(id: string): Promise<number> {
    const raw = await this.client.getRecord(id);
    // Correctly accesses raw.data.length resolving the type mismatch
    return raw.data.length;
  }
}
`,
          isNewFile: false,
        },
      ],
    },
    // Mock diagnostics emitted after initial edit
    mockDiagnostics: [
      {
        file: 'src/service.ts',
        severity: 'error',
        message: "Property 'length' does not exist on type 'RecordResult'. Did you mean 'raw.data.length'?",
        line: 8,
        column: 16,
        source: 'typescript',
        code: 2339,
      },
    ],
  },

  // TASK-06: GIT SAFETY
  {
    taskId: 'TASK-06',
    name: 'Dirty Working Tree Preservation',
    archetype: 'GIT_SAFETY',
    difficulty: 'HARD',
    fixtureDir: 'fixture-06-dirty-worktree',
    prompt: 'Implement the requested feature while preserving all existing developer changes.',
    expectedFilesModified: ['src/routes.ts'],
    forbiddenFilesModified: ['src/auth.ts', 'src/config.ts'],
    requiresGit: true,
    preExistingDirtyFiles: ['src/auth.ts', 'src/config.ts'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Add /api/health route while preserving developer working tree modifications',
        steps: [
          {
            id: 'step-1',
            description: 'Add /api/health endpoint to src/routes.ts',
            files: ['src/routes.ts'],
          },
        ],
        risks: ['Accidental overwrite of pre-existing dirty files'],
        verification: 'npm test',
      },
      edits: [
        {
          relativePath: 'src/routes.ts',
          proposedContent: `export function registerRoutes(app: { get: (path: string, handler: unknown) => void }): void {
  app.get('/api/ping', () => 'pong');
  app.get('/api/health', () => ({ status: 'healthy', uptime: process.uptime() }));
}
`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-07: PARTIAL APPROVAL
  {
    taskId: 'TASK-07',
    name: 'Selective Migration',
    archetype: 'PARTIAL_APPROVAL',
    difficulty: 'MEDIUM',
    fixtureDir: 'fixture-07-partial-approval',
    prompt: 'Update the route and model for the migration. The legacy configuration change is not approved.',
    expectedFilesModified: ['src/routes.ts', 'src/model.ts'],
    forbiddenFilesModified: ['config/legacy.json'],
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      // Selectively approve routes and model, reject config/legacy.json
      approveEdits: {
        approved: true,
        approvedFiles: ['src/routes.ts', 'src/model.ts'],
        rejectedFiles: ['config/legacy.json'],
      },
    },
    verificationCommand: 'npm test',
    mockResponses: {
      plan: {
        goal: 'Migrate routes and model to version 2; propose legacy config freeze',
        steps: [
          {
            id: 'step-1',
            description: 'Update src/routes.ts to return v2/data',
            files: ['src/routes.ts'],
          },
          {
            id: 'step-2',
            description: 'Update src/model.ts to version: 2',
            files: ['src/model.ts'],
          },
          {
            id: 'step-3',
            description: 'Update config/legacy.json with v2 metadata',
            files: ['config/legacy.json'],
          },
        ],
        risks: ['Breaking backwards compatibility if legacy config is altered'],
        verification: 'npm test',
      },
      // Agent proposes all 3 files
      edits: [
        {
          relativePath: 'src/routes.ts',
          proposedContent: `export function setupEndpoints(): string {
  return 'v2/data';
}
`,
          isNewFile: false,
        },
        {
          relativePath: 'src/model.ts',
          proposedContent: `export interface DataModel {
  version: 2;
  id: string;
}
`,
          isNewFile: false,
        },
        {
          relativePath: 'config/legacy.json',
          proposedContent: `{\n  "system": "legacy_v2_unapproved",\n  "deprecated": true\n}\n`,
          isNewFile: false,
        },
      ],
    },
  },

  // TASK-08: EXPLAIN
  {
    taskId: 'TASK-08',
    name: 'Cross-Module Architecture Trace',
    archetype: 'EXPLAIN',
    difficulty: 'EASY',
    fixtureDir: 'fixture-08-architecture-trace',
    prompt: 'Trace the authentication flow from HTTP entrypoint to database lookup and explain the security-sensitive components and trust boundaries.',
    expectedFilesModified: [],
    expectedReadOnly: true,
    timeoutSeconds: 60,
    approvalPolicy: {
      approvePlan: true,
      approveEdits: true,
    },
    mockResponses: {
      plan: {
        goal: 'Perform read-only architecture trace of the authentication pipeline',
        steps: [
          {
            id: 'step-1',
            description: 'Inspect HTTP entrypoint in src/app.ts',
            files: ['src/app.ts'],
          },
          {
            id: 'step-2',
            description: 'Trace middleware in src/middleware/auth.ts and service in src/services/authService.ts',
            files: ['src/middleware/auth.ts', 'src/services/authService.ts'],
          },
          {
            id: 'step-3',
            description: 'Analyze crypto token parser in src/crypto/token.ts and user lookup in src/models/user.ts',
            files: ['src/crypto/token.ts', 'src/models/user.ts'],
          },
        ],
        risks: ['None (read-only)'],
      },
      edits: [], // Read-only task proposes zero file edits
    },
  },
];
