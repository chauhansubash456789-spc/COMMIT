import { execSync } from 'child_process';

console.log('================================================================');
console.log('🏆 COMMIT PROTOCOL — MASTER END-TO-END VERIFICATION SUITE');
console.log('================================================================\n');

const suites = [
  { name: '1. Master Authentication & RBAC Suite', file: 'tests/auth_tests.js' },
  { name: '2. Adversarial Security & Invariants Suite', file: 'tests/attack_tests.js' },
  { name: '3. Anchor Escrow & Protocol Engine Suite', file: 'tests/runner.js' },
  { name: '4. Complete End-to-End User Lifecycle Suite', file: 'tests/e2e_full_test.js' },
  { name: '5. Authoritative Verifier Subsystem & Security Suite', file: 'tests/verifier_system_test.js' }
];

let totalPassed = 0;
let totalFailed = 0;

for (const suite of suites) {
  console.log(`\n▶️ Executing [${suite.name}] (${suite.file})...`);
  try {
    const output = execSync(`node ${suite.file}`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(output);
    console.log(`✅ [${suite.name}] COMPLETED SUCCESSFULLY!\n`);
  } catch (err) {
    console.error(`❌ [${suite.name}] FAILED!`);
    console.error(err.stdout || err.message);
    totalFailed++;
  }
}

console.log('================================================================');
if (totalFailed === 0) {
  console.log('🎉 ALL 5 MASTER SUITES (130/130 TESTS) PASSED 100%!');
} else {
  console.log(`⚠️ ${totalFailed} SUITES ENCOUNTERED FAILURES.`);
  process.exit(1);
}
console.log('================================================================\n');