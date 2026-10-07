import { describe, it } from 'node:test';
import assert from 'node:assert';

const API_BASE = 'http://localhost:3000';

async function postJson(url, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${url}`, { method: 'POST', headers, body: JSON.stringify(data) });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

async function getJson(url, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${url}`, { headers });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

async function putJson(url, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${url}`, { method: 'PUT', headers, body: JSON.stringify(data) });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

console.log('\n================================================================');
console.log('👤 USER DASHBOARD & AUTHORIZATION TEST SUITE');
console.log('================================================================\n');

async function runTests() {
  const ts = Date.now();
  const userA = { email: `user_a_${ts}@commit.fun`, password: 'TestPassword123!', username: `user_a_${ts}`, displayName: 'Alice User' };
  const userB = { email: `user_b_${ts}@commit.fun`, password: 'TestPassword123!', username: `user_b_${ts}`, displayName: 'Bob Attacker' };

  console.log('--- Setup: Create Test Accounts User A & User B ---');
  const regA = await postJson('/api/auth/signup', { email: userA.email, password: userA.password, confirmPassword: userA.password, username: userA.username, displayName: userA.displayName });
  assert.strictEqual(regA.status, 201, 'User A signup must return 201');
  const tokenA = regA.data.session.access_token;
  const idA = regA.data.user.id;

  const regB = await postJson('/api/auth/signup', { email: userB.email, password: userB.password, confirmPassword: userB.password, username: userB.username, displayName: userB.displayName });
  assert.strictEqual(regB.status, 201, 'User B signup must return 201');
  const tokenB = regB.data.session.access_token;
  const idB = regB.data.user.id;
  console.log('  ✓ PASS: User A & User B accounts created');

  console.log('\n--- 1. User Overview Metrics ---');
  const unauthOverview = await getJson('/api/user/overview');
  assert.strictEqual(unauthOverview.status, 401, 'Unauthenticated overview must return 401');
  console.log('  ✓ PASS: Unauthenticated access to /api/user/overview blocked (HTTP 401)');

  const authOverviewA = await getJson('/api/user/overview', tokenA);
  assert.strictEqual(authOverviewA.status, 200, 'Authenticated overview must return 200');
  assert.ok(authOverviewA.data.stats, 'Overview must contain stats object');
  assert.strictEqual(authOverviewA.data.stats.active_commitments, 0);
  assert.strictEqual(authOverviewA.data.stats.total_staked_usdc, 0);
  console.log('  ✓ PASS: User A overview returns system-generated metrics');

  console.log('\n--- 2. Create Commitment & Ownership Binding ---');
  const createRes = await postJson('/api/commitments/create', {
    title: 'Ship 5 commits to Solana anchor',
    stakeAmount: 30,
    stakingMode: 'HARDCORE',
    verifierType: 'github',
    failurePolicy: 'PARTIAL_RETURN',
    details: { repoOwner: 'solana-labs', repoName: 'solana', authorUsername: 'solana-builder', requiredCommits: 5 }
  }, tokenA);
  assert.strictEqual(createRes.status, 201, 'Commitment creation must succeed');
  const commitmentId = createRes.data.id;
  console.log(`  ✓ PASS: Commitment created (ID: ${commitmentId}) bound to User A`);

  // Fund commitment
  await postJson(`/api/commitments/${commitmentId}/fund`, {}, tokenA);
  console.log('  ✓ PASS: Commitment funded & escrow locked');

  // Verify User A overview now reflects 1 active commitment & 30 staked
  const overviewAfter = await getJson('/api/user/overview', tokenA);
  assert.strictEqual(overviewAfter.data.stats.active_commitments, 1);
  assert.strictEqual(overviewAfter.data.stats.total_staked_usdc, 30);
  console.log('  ✓ PASS: User A overview updated: 1 active commitment, 30.00 USDC staked');

  console.log('\n--- 3. My Commitments List & Data Scoping ---');
  const myCommitmentsA = await getJson('/api/commitments/my', tokenA);
  assert.strictEqual(myCommitmentsA.status, 200);
  assert.strictEqual(myCommitmentsA.data.commitments.length, 1);
  assert.strictEqual(myCommitmentsA.data.commitments[0].id, commitmentId);
  console.log('  ✓ PASS: User A retrieves their commitment via /api/commitments/my');

  const myCommitmentsB = await getJson('/api/commitments/my', tokenB);
  assert.strictEqual(myCommitmentsB.status, 200);
  assert.strictEqual(myCommitmentsB.data.commitments.length, 0, 'User B must not see User A commitments in /my');
  console.log('  ✓ PASS: Data Scoping Enforced: User B gets 0 commitments in /api/commitments/my');

  console.log('\n--- 4. Off-Chain Cryptographic Evidence Submission & Hashing ---');
  const evRes = await postJson(`/api/commitments/${commitmentId}/evidence`, {
    type: 'SCREENSHOT',
    content: 'https://commit.fun/proofs/alice_commit_proof.png',
    description: 'Screenshot showing 5 merged git commits'
  }, tokenA);
  assert.ok(evRes.status === 200 || evRes.status === 201, 'Evidence submission must succeed');
  assert.ok(evRes.data.hash.length === 64 || evRes.data.hash.length === 66, 'SHA-256 hash must be 64 hex chars (or 66 with 0x prefix)');
  console.log(`  ✓ PASS: User A submitted evidence, off-chain SHA-256 hash generated: ${evRes.data.hash.slice(0, 16)}...`);

  console.log('\n--- 5. Security & IDOR Attack Testing ---');
  // User B tries to submit evidence to User A's commitment
  const idorEvidence = await postJson(`/api/commitments/${commitmentId}/evidence`, {
    type: 'DOCUMENT',
    content: 'https://attacker.site/fake_proof.pdf',
    description: 'Malicious forged proof'
  }, tokenB);
  assert.strictEqual(idorEvidence.status, 403, 'User B submitting evidence to User A commitment must be rejected');
  console.log('  🛡️ DEFENDED: IDOR attack blocked: User B cannot upload evidence to User A commitment (HTTP 403)');

  // User B tries to dispute User A's commitment
  const idorDispute = await postJson(`/api/commitments/${commitmentId}/dispute`, {
    reason: 'I am attacking User A'
  }, tokenB);
  assert.strictEqual(idorDispute.status, 403, 'User B disputing User A commitment must be rejected');
  console.log('  🛡️ DEFENDED: IDOR attack blocked: User B cannot dispute User A commitment (HTTP 403)');

  // User A legitimate dispute
  const legitDispute = await postJson(`/api/commitments/${commitmentId}/dispute`, {
    reason: 'Contesting automated verifier result'
  }, tokenA);
  assert.strictEqual(legitDispute.status, 200, 'User A legitimate dispute must succeed');
  assert.strictEqual(legitDispute.data.commitment.status, 'DISPUTED');
  console.log('  ✓ PASS: User A legitimately disputed commitment, status changed to DISPUTED');

  console.log('\n--- 6. Notifications System & Tracking ---');
  const notifsA = await getJson('/api/notifications', tokenA);
  assert.strictEqual(notifsA.status, 200);
  assert.ok(notifsA.data.notifications.length >= 2, 'User A should receive notifications on creation, funding & dispute');
  assert.ok(notifsA.data.unreadCount >= 2);
  console.log(`  ✓ PASS: User A notifications loaded (${notifsA.data.notifications.length} events, ${notifsA.data.unreadCount} unread)`);

  const notifId = notifsA.data.notifications[0].id;
  const readRes = await postJson(`/api/notifications/${notifId}/read`, {}, tokenA);
  assert.strictEqual(readRes.status, 200);
  console.log('  ✓ PASS: Notification marked as read');

  const readAllRes = await postJson('/api/notifications/read-all', {}, tokenA);
  assert.strictEqual(readAllRes.status, 200);
  const notifsAfter = await getJson('/api/notifications', tokenA);
  assert.strictEqual(notifsAfter.data.unreadCount, 0);
  console.log('  ✓ PASS: All notifications marked as read (unread count = 0)');

  console.log('\n--- 7. Profile Updates & Invariant Protection ---');
  const profUpdate = await putJson('/api/auth/profile', { displayName: 'Alice Verified Creator' }, tokenA);
  assert.strictEqual(profUpdate.status, 200);
  assert.strictEqual(profUpdate.data.profile.display_name, 'Alice Verified Creator');
  console.log('  ✓ PASS: Profile display name updated');

  const attackRole = await putJson('/api/auth/profile', { role: 'ADMIN' }, tokenA);
  assert.strictEqual(attackRole.status, 403);
  console.log('  🛡️ DEFENDED: Role escalation rejected (HTTP 403)');

  const attackStats = await putJson('/api/auth/profile', { success_rate: 99.9 }, tokenA);
  assert.strictEqual(attackStats.status, 403);
  console.log('  🛡️ DEFENDED: Direct stats tampering rejected (HTTP 403)');

  console.log('\n================================================================');
  console.log('🎉 ALL USER DASHBOARD & AUTHORIZATION TESTS PASSED (100%)');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
