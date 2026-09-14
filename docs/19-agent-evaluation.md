# 19 — AI Agent Scientific Evaluation & Benchmarking

## 1. Evaluation Philosophy: Empirical Rigor Over Demos

Most AI coding assistants rely on subjective video demos and cherry-picked prompts. ForgeAI establishes an **Empirical Evaluation Framework** (`packages/forgeai-eval`) to measure agent capability, regression rates, and tool efficiency scientifically across model releases and code iterations.

---

## 2. Core Quantitative Metrics

Every benchmark run computes an automated evaluation scorecard tracking eight key dimensions:

| Metric | Target (v0.1.0 MVP) | Measurement Definition |
|---|---|---|
| **Task Success Rate (TSR)** | $\ge 80\%$ | Percentage of benchmark tasks where all verification tests pass and goal criteria are satisfied. |
| **First-Attempt Success (FAS)** | $\ge 60\%$ | Percentage of tasks resolved on the very first plan execution without triggering the diagnostic self-healing loop. |
| **Test Pass Rate (TPR)** | $\ge 95\%$ | Ratio of passing unit/integration tests across all modified modules. |
| **Regression Rate (RR)** | $\le 2\%$ | Percentage of pre-existing, previously passing tests broken by agent modifications. |
| **Tool Call Efficiency** | $\le 6.5$ calls/task | Average number of discrete tool executions required to complete a multi-file task. |
| **Token Economy** | $\le 12,000$ tok/task | Average total tokens (prompt + completion) consumed per resolved task. |
| **Task Latency** | $\le 25$ seconds | Wall-clock execution time from user prompt to test verification. |
| **Human Interventions** | $\le 1.5$ approvals | Number of times developer intervention was required (plan approval, permission confirmation). |

---

## 3. Evaluation Benchmark Dataset (Benchmark-25)

The evaluation suite includes 25 curated, realistic coding tasks across 5 distinct archetypes:

```
packages/forgeai-eval/benchmarks/
├── archetype-1-explain/        # Repository exploration and architecture explanation
├── archetype-2-feature/        # End-to-end multi-file feature implementation
├── archetype-3-debug/          # Diagnosing and repairing broken test suites
├── archetype-4-refactor/       # Structural refactoring without behavioral regression
└── archetype-5-testgen/        # Edge-case unit test synthesis
```

### 3.1 Task Schema Specification
```json
{
  "taskId": "BENCH-003",
  "archetype": "DEBUG",
  "difficulty": "MEDIUM",
  "repository": "fixtures/express-auth-microservice",
  "prompt": "The test suite in tests/jwt.test.ts is failing due to token expiration clock skew. Diagnose and fix the issue.",
  "setupCommand": "npm install",
  "evalCommand": "npm test tests/jwt.test.ts",
  "expectedFilesModified": ["src/jwt.ts"],
  "forbiddenFilesModified": ["tests/jwt.test.ts", "package.json"],
  "timeoutSeconds": 180,
  "successCriteria": {
    "evalCommandExitCode": 0,
    "regressionCheckExitCode": 0,
    "forbiddenFilesUntouched": true
  }
}
```

---

## 4. Benchmark Execution Harness

The evaluation harness operates completely headlessly:
```bash
# Run full evaluation across all benchmark tasks with Claude 3.5 Sonnet
npm run eval -- --provider=anthropic --model=claude-3-5-sonnet-20241022 --dataset=benchmarks/

# Run fast regression check on debug archetype with local Ollama
npm run eval -- --provider=ollama --model=qwen2.5-coder:14b --archetype=debug
```

### Automated Report Generation (`eval-report.json`)
```json
{
  "timestamp": 1773729600000,
  "model": "claude-3-5-sonnet-20241022",
  "totalTasks": 25,
  "successfulTasks": 21,
  "taskSuccessRate": 0.84,
  "firstAttemptSuccessRate": 0.68,
  "averageTokensPerTask": 9420,
  "averageLatencySeconds": 18.4,
  "regressionRate": 0.00
}
```
This report enables continuous tracking across git commits to prevent agent performance degradation.
