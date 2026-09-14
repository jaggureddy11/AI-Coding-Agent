# @jaggu/eval — JAGGU Engineering Evaluation Suite

Deterministic evaluation and benchmarking suite for measuring the capability, reliability, safety, and developer control of the JAGGU coding agent architecture.

## Overview

`@jaggu/eval` runs a standardized battery of realistic software engineering tasks across sandboxed fixture repositories. It directly exercises JAGGU's orchestration, planning, multi-file editing, diagnostics, self-healing repair, and Git safety invariants without requiring external network connectivity, API keys, or live language servers.

## Benchmark Archetypes (8 Tasks)

1. **TASK-01 (FEATURE)**: Authentication Rate Limiting (`fixture-01-rate-limiter`)
2. **TASK-02 (DEBUG)**: JWT Expiration Clock Skew (`fixture-02-jwt-clockskew`)
3. **TASK-03 (REFACTOR)**: Repository Decoupling (`fixture-03-repo-decoupling`)
4. **TASK-04 (TESTGEN)**: Boundary Validation Tests (`fixture-04-boundary-validation`)
5. **TASK-05 (CODE_INTEL)**: Type Error Recovery (`fixture-05-type-error-recovery`)
6. **TASK-06 (GIT_SAFETY)**: Dirty Working Tree Preservation (`fixture-06-dirty-worktree`)
7. **TASK-07 (PARTIAL_APPROVAL)**: Selective Migration (`fixture-07-partial-approval`)
8. **TASK-08 (EXPLAIN)**: Cross-Module Architecture Trace (`fixture-08-architecture-trace`)

## Running the Benchmark

### Run the full evaluation baseline:
```bash
npm run eval --workspace=@jaggu/eval
```

### Run unit tests for the evaluation harness:
```bash
npm test -- packages/jaggu-eval
```

## Results & Scorecards

- Aggregate scorecard: `results/scorecard-baseline.json`
- Raw task JSON results: `results/raw/<timestamp>/`
- Architectural analysis & findings: `docs/evaluation/JAGGU-engineering-evaluation-v0.1.md`
