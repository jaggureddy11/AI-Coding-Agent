import { BenchmarkEvaluator } from './evaluator.js';
import { BENCHMARK_TASKS } from './registry.js';

async function main() {
  console.log('===============================================================');
  console.log('       JAGGU Engineering Evaluation v0.1 — Baseline Run       ');
  console.log('===============================================================');
  console.log(`Starting baseline execution across ${BENCHMARK_TASKS.length} benchmark tasks...\n`);

  const evaluator = new BenchmarkEvaluator();
  const startTime = Date.now();

  const scorecard = await evaluator.runSuite(BENCHMARK_TASKS, startTime);

  console.log('\n===============================================================');
  console.log('                 BASELINE EVALUATION SCORECARD                 ');
  console.log('===============================================================');
  console.log(`Total Benchmark Tasks:         ${scorecard.totalTasks}`);
  console.log(`Successful Tasks:              ${scorecard.successfulTasks} / ${scorecard.totalTasks}`);
  console.log(`Task Success Rate (TSR):       ${(scorecard.taskSuccessRate * 100).toFixed(1)}%`);
  console.log(`First-Attempt Success (FAS):   ${scorecard.firstAttemptSuccessCount} / ${scorecard.totalTasks} (${(scorecard.firstAttemptSuccessRate * 100).toFixed(1)}%)`);
  console.log(`Average Repair Attempts:       ${scorecard.averageRepairAttempts.toFixed(2)}`);
  console.log(`Max Repair Attempts:           ${scorecard.maxRepairAttempts}`);
  console.log(`Critical Safety Failures:      ${scorecard.criticalSafetyFailures}`);
  console.log(`User Changes Preserved Rate:   ${(scorecard.userChangesPreservedRate * 100).toFixed(1)}%`);
  console.log(`Scope Compliance Rate:         ${(scorecard.scopeComplianceRate * 100).toFixed(1)}%`);
  console.log(`Average Latency:               ${(scorecard.averageLatencyMs / 1000).toFixed(2)}s`);
  console.log('---------------------------------------------------------------');
  console.log('| Task ID | Archetype        | Result | 1st Att | Repairs | Tests | Diags | Scope | User Chg |');
  console.log('---------------------------------------------------------------');

  for (const r of scorecard.results) {
    const id = r.taskId.padEnd(7);
    const arch = r.archetype.padEnd(16);
    const res = (r.success ? 'PASS' : 'FAIL').padEnd(6);
    const fas = (r.firstAttemptSuccess ? 'YES' : 'NO').padEnd(7);
    const rep = String(r.repairAttempts).padEnd(7);
    const tst = r.verification.testsStatus.padEnd(5);
    const dia = (r.verification.diagnosticsStatus === 'CLEAN' ? 'CLEAN' : r.verification.diagnosticsStatus === 'ERRORS' ? 'ERR' : 'N/A').padEnd(5);
    const scp = (r.scope.compliant ? 'OK' : 'VIOL').padEnd(5);
    const uch = (r.gitSafety.userChangesPreserved ? 'PRESERVED' : 'DESTROYED').padEnd(8);
    console.log(`| ${id} | ${arch} | ${res} | ${fas} | ${rep} | ${tst} | ${dia} | ${scp} | ${uch} |`);
  }
  console.log('---------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('Fatal evaluation runner error:', err);
  process.exit(1);
});
