import assert from 'assert';
import { supabaseAdmin, supabaseAnon } from '../server/auth/supabase.js';
import { verifyAttestationSignature } from '../server/oracle/attestation.js';

const API_BASE = 'http://localhost:3000';

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let testCreatorToken = null;
let testCreatorUser = null;
let testVerifierAToken = null;
let testVerifierAUser = null;
let verifierAProfileId = null;
let testVerifierBToken = null;
let testVerifierBUser = null;
let verifierBProfileId = null;
let testAdminToken = null;
let testAdminUser = null;

let sharedCommitmentId = null;
let sharedRequestId = null;

async function setupTestUsers() {
  const rand = Math.random().toString(36).substring(2, 7);

  const creatorEmail = `creator_${rand}@commit.test`;
  const verifierAEmail = `verifierA_${rand}@commit.test`;
  const verifierBEmail = `verifierB_${rand}@commit.test`;
  const adminEmail = `admin_${rand}@commit.test`;
  const password = 'Password123!Secure';

  const { data: uCreator } = await supabaseAdmin.auth.admin.createUser({
    email: creatorEmail,
    password,
    email_confirm: true,
    user_metadata: { username: `creator_${rand}`, display_name: 'Creator Bob' }
  });
  testCreatorUser = uCreator.user;

  const { data: uVerA } = await supabaseAdmin.auth.admin.createUser({
    email: verifierAEmail,
    password,
    email_confirm: true,
    user_metadata: { username: `ver_a_${rand}`, display_name: 'Verifier Alice' }
  });
  testVerifierAUser = uVerA.user;

  const { data: uVerB } = await supabaseAdmin.auth.admin.createUser({
    email: verifierBEmail,
    password,
    email_confirm: true,
    user_metadata: { username: `ver_b_${rand}`, display_name: 'Verifier Bob' }
  });
  testVerifierBUser = uVerB.user;

  const { data: uAdmin } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { username: `adm_${rand}`, display_name: 'Admin Carol' }
  });
  testAdminUser = uAdmin.user;

  // Make Carol an Admin
  await supabaseAdmin
    .from('user_profiles')
    .update({ role: 'ADMIN' })
    .eq('auth_user_id', testAdminUser.id);

  // Authenticate and acquire session JWTs
  const sCreator = await supabaseAnon.auth.signInWithPassword({ email: creatorEmail, password });
  testCreatorToken = sCreator.data.session.access_token;

  const sVerA = await supabaseAnon.auth.signInWithPassword({ email: verifierAEmail, password });
  testVerifierAToken = sVerA.data.session.access_token;

  const sVerB = await supabaseAnon.auth.signInWithPassword({ email: verifierBEmail, password });
  testVerifierBToken = sVerB.data.session.access_token;

  const sAdmin = await supabaseAnon.auth.signInWithPassword({ email: adminEmail, password });
  testAdminToken = sAdmin.data.session.access_token;
}

async function runVerifierTests() {
  console.log('\n================================================================');
  console.log('🛡️ COMMIT PROTOCOL — COMPLETE VERIFIER SYSTEM TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}\n     ${err.message}`);
        failed++;
      }
    };
  }

  await setupTestUsers();

  const battery = [
    // -------------------------------------------------------------------------
    // 1. VERIFIER ONBOARDING & STATUS FLOW
    // -------------------------------------------------------------------------
    test('Verifier Onboarding: User submits application with safe metadata', async () => {
      const res = await api('/api/auth/verifier/apply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({
          displayName: 'Alice M. (Inspector)',
          bio: 'Decentralized systems auditor and physical task verification specialist',
          specializations: ['Electronics', 'Physical Tasks'],
          serviceArea: 'San Francisco, CA',
          verificationType: 'human_physical',
          availability: 'Available'
        })
      });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      assert.ok(res.data.verifier, 'Must return verifier application object');
      assert.strictEqual(res.data.verifier.status, 'PENDING', 'New application status must be PENDING');
      assert.strictEqual(res.data.verifier.level, 'NEW', 'Level must default to NEW');
      verifierAProfileId = res.data.verifier.id;
    }),

    test('Privilege Escalation Defense: Client cannot force role=VERIFIER or status=TRUSTED', async () => {
      const res = await api('/api/auth/verifier/apply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierBToken}` },
        body: JSON.stringify({
          displayName: 'Bob Malicious',
          role: 'SUPER_ADMIN',
          status: 'TRUSTED',
          verification_status: 'TRUSTED',
          accuracy_rate: 100
        })
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.verifier.status, 'PENDING', 'Role and status must remain server-controlled PENDING');
      verifierBProfileId = res.data.verifier.id;
    }),

    test('Pending Verifier Gate: Pending verifier is blocked from verifier workspace', async () => {
      const res = await api('/api/verifier/dashboard', {
        headers: { Authorization: `Bearer ${testVerifierAToken}` }
      });
      assert.strictEqual(res.status, 403, 'Pending verifier must be blocked with HTTP 403');
    }),

    test('Admin Approval: Administrator reviews and approves verifier application', async () => {
      const res = await api(`/api/admin/verifiers/${verifierAProfileId}/status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testAdminToken}` },
        body: JSON.stringify({
          verificationStatus: 'VERIFIED',
          verificationLevel: 'VERIFIED',
          reason: 'Application approved by security administrator'
        })
      });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      assert.strictEqual(res.data.verifier.verification_status, 'VERIFIED');

      // Now Verifier A should have full dashboard access
      const dashRes = await api('/api/verifier/dashboard', {
        headers: { Authorization: `Bearer ${testVerifierAToken}` }
      });
      assert.strictEqual(dashRes.status, 200, `Approved verifier must receive 200, got ${dashRes.status}`);
      assert.ok(dashRes.data.profile, 'Dashboard must return profile');
      assert.ok(dashRes.data.stats, 'Dashboard must return authoritative stats');
    }),

    // -------------------------------------------------------------------------
    // 2. COMMITMENT CREATION & REQUEST QUEUE
    // -------------------------------------------------------------------------
    test('Task Creation: Creator creates physical task commitment and funds it', async () => {
      const cmRes = await api('/api/commitments/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCreatorToken}` },
        body: JSON.stringify({
          title: 'Electronics lab workbench cleanup and organization',
          creator: 'CreatorWalletAddress11111111111111111111111',
          stakingMode: 'HARDCORE',
          stakeAmount: 50,
          penaltyAmount: 15,
          verificationFee: 3.0,
          verifierType: 'peer_consensus',
          failurePolicy: 'PARTIAL_COMMUNITY_POOL',
          failurePolicyText: '35 USDC returned, 15 USDC forfeited',
          details: {
            checklist: [
              { id: 'chk_1', label: 'Work surface cleared of debris', required: true, checked: false },
              { id: 'chk_2', label: 'Tools categorized in bins', required: true, checked: false }
            ],
            locationRequirement: {
              address: 'Hardware Bay 4, San Francisco, CA',
              lat: 37.7749,
              lng: -122.4194,
              radiusMeters: 250
            }
          }
        })
      });

      assert.strictEqual(cmRes.status, 201, `Expected 201, got ${cmRes.status}`);
      sharedCommitmentId = cmRes.data.id;

      // Fund the commitment
      const fundRes = await api(`/api/commitments/${sharedCommitmentId}/fund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCreatorToken}` }
      });
      assert.strictEqual(fundRes.status, 200);

      // Verifier A checks requests queue to find this task
      const reqsRes = await api('/api/verifier/requests', {
        headers: { Authorization: `Bearer ${testVerifierAToken}` }
      });
      assert.strictEqual(reqsRes.status, 200);
      assert.ok(Array.isArray(reqsRes.data.requests));
      const targetReq = reqsRes.data.requests.find(r => r.commitment_id === sharedCommitmentId);
      assert.ok(targetReq, 'Verification request must appear in verifier requests queue');
      sharedRequestId = targetReq.id;
    }),

    // -------------------------------------------------------------------------
    // 3. CONFLICT OF INTEREST / ANTI-SELF-VERIFICATION
    // -------------------------------------------------------------------------
    test('Conflict of Interest: Creator cannot verify their own commitment', async () => {
      // Approve creator as a verifier to test self-verification attempt
      await api('/api/auth/verifier/apply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCreatorToken}` },
        body: JSON.stringify({ displayName: 'Creator As Verifier' })
      });

      const { data: creatorProf } = await supabaseAdmin
        .from('verifier_profiles')
        .select('id')
        .eq('user_id', (await supabaseAdmin.from('user_profiles').select('id').eq('auth_user_id', testCreatorUser.id).single()).data.id)
        .single();

      await api(`/api/admin/verifiers/${creatorProf.id}/status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testAdminToken}` },
        body: JSON.stringify({ verificationStatus: 'VERIFIED' })
      });

      // Creator attempts to accept their own task
      const res = await api(`/api/verifier/requests/${sharedRequestId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCreatorToken}` }
      });

      assert.strictEqual(res.status, 400, 'Self-verification attempt must be rejected with 400');
      assert.ok(res.data.error.includes('Conflict of Interest'), 'Error message must specify Conflict of Interest');
    }),

    // -------------------------------------------------------------------------
    // 4. REQUEST ACCEPTANCE & SCOPED ISOLATION (ANTI-IDOR)
    // -------------------------------------------------------------------------
    test('Acceptance: Verifier A accepts the verification task', async () => {
      const res = await api(`/api/verifier/requests/${sharedRequestId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` }
      });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.data.request.status, 'ACCEPTED');
      assert.ok(res.data.request.accepted_at, 'Must record accepted_at timestamp');
    }),

    test('Anti-IDOR: Verifier B cannot view or access Verifier A private request', async () => {
      // Approve Verifier B so they have verifier role
      await api(`/api/admin/verifiers/${verifierBProfileId}/status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testAdminToken}` },
        body: JSON.stringify({ verificationStatus: 'VERIFIED' })
      });

      // Verifier B attempts to fetch Verifier A's assigned request
      const res = await api(`/api/verifier/requests/${sharedRequestId}`, {
        headers: { Authorization: `Bearer ${testVerifierBToken}` }
      });

      assert.strictEqual(res.status, 404, 'Verifier B must receive 404 (Access Denied / Anti-IDOR)');
    }),

    // -------------------------------------------------------------------------
    // 5. EPHEMERAL CHECK-IN QR & SUPPORTING LOCATION
    // -------------------------------------------------------------------------
    test('Check-in QR: Verifier A generates 5-minute ephemeral check-in QR', async () => {
      const res = await api('/api/verifier/checkin/qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({ requestId: sharedRequestId })
      });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.ok(res.data.qrToken, 'Must generate qrToken');
      assert.ok(res.data.expiresAt > Date.now(), 'Token expiresAt must be in the future');
      assert.ok(res.data.formattedCode.startsWith('COMMIT-CHECKIN-'), 'Must provide human-formatted code');
    }),

    test('QR Security: Check-in succeeds and anti-replay prevents reusing token', async () => {
      const qrRes = await api('/api/verifier/checkin/qr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({ requestId: sharedRequestId })
      });
      const token = qrRes.data.qrToken;

      // 1. Valid Check-in (within 250m radius of SF location)
      const firstCheckin = await api('/api/verifier/checkin/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({
          requestId: sharedRequestId,
          qrToken: token,
          verifierLocation: { lat: 37.7749, lng: -122.4194 }
        })
      });

      assert.strictEqual(firstCheckin.status, 200, 'Valid check-in must succeed');
      assert.strictEqual(firstCheckin.data.checkin.locationVerified, true, 'Location within radius must be verified');

      // 2. Replay Attack: Using the exact same QR token again
      const replayCheckin = await api('/api/verifier/checkin/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({
          requestId: sharedRequestId,
          qrToken: token,
          verifierLocation: { lat: 37.7749, lng: -122.4194 }
        })
      });

      assert.strictEqual(replayCheckin.status, 400, 'Replay of burned QR token must be rejected');
      assert.ok(replayCheckin.data.error.includes('Replay detected'), 'Error must specify Replay detected');
    }),

    test('QR Security: Forged or non-existent QR token is rejected', async () => {
      const res = await api('/api/verifier/checkin/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({
          requestId: sharedRequestId,
          qrToken: 'forged_fake_qr_token_abc123'
        })
      });

      assert.strictEqual(res.status, 400, 'Forged QR token must be rejected');
    }),

    // -------------------------------------------------------------------------
    // 6. EVIDENCE SUBMISSION & PRIVACY
    // -------------------------------------------------------------------------
    test('Evidence Submission: Verifier uploads evidence with SHA-256 integrity hash', async () => {
      const res = await api(`/api/verifier/evidence/${sharedRequestId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({
          mediaUrl: 'https://commit.protocol/proofs/workbench_clean.jpg',
          description: 'Workbench cleared, tools sorted, verified on site',
          mediaType: 'image'
        })
      });

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      assert.ok(res.data.evidence.sha256Hash.startsWith('0x'), 'Must calculate 0x SHA-256 hash server-side');
    }),

    test('Evidence Privacy: Random verifier B cannot access private evidence', async () => {
      const res = await api(`/api/verifier/evidence/${sharedCommitmentId}`, {
        headers: { Authorization: `Bearer ${testVerifierBToken}` }
      });

      assert.strictEqual(res.status, 403, 'Unrelated verifier must be denied private evidence access');
    }),

    // -------------------------------------------------------------------------
    // 7. LOCKED CHECKLIST EVALUATION & PASS/FAIL ATTESTATION
    // -------------------------------------------------------------------------
    test('Locked Checklist: Submitting PASS when required checklist items are incomplete is rejected', async () => {
      const res = await api(`/api/verifier/requests/${sharedRequestId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({
          outcome: 'PASS',
          checklistEvaluations: [
            { id: 'chk_1', checked: true },
            { id: 'chk_2', checked: false } // Required item unchecked!
          ],
          notes: 'Attempting pass without complete criteria'
        })
      });

      assert.strictEqual(res.status, 400, 'Incomplete required checklist must reject PASS outcome');
      assert.ok(res.data.error.includes('Checklist Incomplete'), 'Must return Checklist Incomplete');
    }),

    test('PASS Attestation: Submitting PASS with completed checklist produces Ed25519 Oracle attestation', async () => {
      const res = await api(`/api/verifier/requests/${sharedRequestId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({
          outcome: 'PASS',
          checklistEvaluations: [
            { id: 'chk_1', checked: true },
            { id: 'chk_2', checked: true }
          ],
          notes: 'Workbench cleared and tools organized. All criteria verified.'
        })
      });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.data.result.resultCode, 'HUMAN_PASS');

      const attestation = res.data.result.attestation;
      assert.ok(attestation, 'Must return signed attestation');
      const isSigValid = verifyAttestationSignature(attestation);
      assert.strictEqual(isSigValid, true, 'Oracle Ed25519 signature must be mathematically valid');
    }),

    // -------------------------------------------------------------------------
    // 8. SOLANA SETTLEMENT & IMMUTABLE REWARDS
    // -------------------------------------------------------------------------
    test('Settlement & Reward: Solana settlement credits verifier reward', async () => {
      const settleRes = await api(`/api/commitments/${sharedCommitmentId}/settle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCreatorToken}` }
      });

      assert.strictEqual(settleRes.status, 200, `Expected 200, got ${settleRes.status}`);
      assert.strictEqual(settleRes.data.commitment.status, 'SETTLED');

      // Check Verifier A earnings ledger
      const earnRes = await api('/api/verifier/earnings', {
        headers: { Authorization: `Bearer ${testVerifierAToken}` }
      });

      assert.strictEqual(earnRes.status, 200);
      assert.ok(earnRes.data.totalEarned >= 3.0, 'Earnings must include the 3.00 USDC reward');
      const item = earnRes.data.earnings.find(e => e.commitmentId === sharedCommitmentId);
      assert.ok(item, 'Earning record must exist for settled commitment');
      assert.strictEqual(item.status, 'SETTLED');
    }),

    // -------------------------------------------------------------------------
    // 9. AUTHORITATIVE USER RATINGS (ANTI-SELF-RATING, ANTI-DUPLICATE)
    // -------------------------------------------------------------------------
    test('User Rating: Creator rates verifier 5 stars for completed inspection', async () => {
      const res = await api('/api/verifier/rate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCreatorToken}` },
        body: JSON.stringify({
          commitmentId: sharedCommitmentId,
          verifierId: verifierAProfileId,
          rating: 5,
          comment: 'Outstanding and thorough verification!'
        })
      });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.data.rating, 5);
    }),

    test('Anti-Self-Rating: Verifier cannot rate themselves', async () => {
      const res = await api('/api/verifier/rate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({
          commitmentId: sharedCommitmentId,
          verifierId: verifierAProfileId,
          rating: 5
        })
      });

      assert.strictEqual(res.status, 400, 'Self-rating must be rejected');
      assert.ok(res.data.error.includes('Conflict of Interest'), 'Error must specify Conflict of Interest');
    }),

    test('Duplicate Rating Defense: User cannot rate the same verification twice', async () => {
      const res = await api('/api/verifier/rate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testCreatorToken}` },
        body: JSON.stringify({
          commitmentId: sharedCommitmentId,
          verifierId: verifierAProfileId,
          rating: 5
        })
      });

      assert.strictEqual(res.status, 400, 'Duplicate rating must be rejected');
      assert.ok(res.data.error.includes('Duplicate rating rejected'), 'Error must specify Duplicate rating rejected');
    }),

    // -------------------------------------------------------------------------
    // 10. ADMIN CONTROLS & SUSPENSION
    // -------------------------------------------------------------------------
    test('Admin Suspension: Admin suspends verifier and blocks new assignments', async () => {
      const res = await api(`/api/admin/verifiers/${verifierAProfileId}/status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testAdminToken}` },
        body: JSON.stringify({
          verificationStatus: 'SUSPENDED',
          reason: 'Investigation of reported conduct'
        })
      });

      assert.strictEqual(res.status, 200);

      // Verifier A should now be forbidden from accepting requests
      const acceptRes = await api('/api/verifier/requests/any_req/accept', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testVerifierAToken}` }
      });
      assert.strictEqual(acceptRes.status, 403, 'Suspended verifier must receive 403');
    }),

    test('Verifier Availability: Updates availability state', async () => {
      // Re-enable verifier A
      await api(`/api/admin/verifiers/${verifierAProfileId}/status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${testAdminToken}` },
        body: JSON.stringify({ verificationStatus: 'VERIFIED' })
      });

      const res = await api('/api/verifier/availability', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${testVerifierAToken}` },
        body: JSON.stringify({ availability: 'Busy' })
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.availability, 'Busy');
    })
  ];

  for (const t of battery) {
    await t();
  }

  console.log('\n================================================================');
  console.log(`🎯 VERIFIER SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerifierTests().catch(err => {
  console.error('[FATAL TEST SUITE ERROR]', err);
  process.exit(1);
});
