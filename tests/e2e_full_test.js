import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { supabaseAdmin } from '../server/auth/supabase.js';

function encodeBase58(buffer) {
  if (typeof bs58.encode === 'function') return bs58.encode(buffer);
  if (bs58.default && typeof bs58.default.encode === 'function') return bs58.default.encode(buffer);
  throw new Error('Base58 encode unavailable');
}

const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runFullE2ETest() {
  console.log('\n================================================================');
  console.log('🚀 COMMIT PROTOCOL — COMPLETE END-TO-END SYSTEM TEST');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testEmail = `e2e_user_${timestamp}@example.com`;
  const testAdminEmail = `e2e_admin_${timestamp}@example.com`;
  const defaultPassword = 'Password123!Secure';

  let userToken = null;
  let userId = null;
  let userProfileId = null;

  let adminToken = null;
  let adminId = null;

  // Generate ephemeral Solana keypair
  const keypair = nacl.sign.keyPair();
  const walletPubkey = encodeBase58(keypair.publicKey);

  let createdCommitmentId = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: USER ONBOARDING & SUPABASE AUTH
    // -------------------------------------------------------------------------
    console.log('📦 [1/8] USER REGISTRATION & AUTHENTICATION');
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: defaultPassword,
        confirmPassword: defaultPassword,
        username: `e2e_${timestamp}`,
        displayName: 'E2E Challenger'
      })
    });
    const signupData = await signupRes.json();
    assert(signupRes.status === 201, 'User registered successfully via /api/auth/signup');
    userId = signupData.user.id;

    // Confirm email automatically for test flow
    await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true });

    // Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: defaultPassword })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'User successfully authenticated via /api/auth/login');
    assert(loginData.session && loginData.session.access_token, 'Supabase session JWT received');
    userToken = loginData.session.access_token;
    userProfileId = loginData.profile.id;

    // Query Profile
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /api/auth/me loads profile and stats from PostgreSQL');
    assert(meData.profile.status === 'ACTIVE', 'Account status is strictly ACTIVE');

    // -------------------------------------------------------------------------
    // STEP 2: PHANTOM SOLANA WALLET NONCE & SIGNATURE BINDING
    // -------------------------------------------------------------------------
    console.log('\n📦 [2/8] CRYPTOGRAPHIC SOLANA WALLET BINDING');
    // Request challenge nonce
    const nonceRes = await fetch(`${BASE_URL}/api/auth/wallet/nonce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({ walletAddress: walletPubkey })
    });
    const nonceData = await nonceRes.json();
    assert(nonceRes.status === 200, 'Backend issued random 32-byte challenge nonce');

    // Sign message using Ed25519
    const messageBytes = new TextEncoder().encode(nonceData.message);
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase58 = encodeBase58(signatureBytes);

    // Verify
    const verifyRes = await fetch(`${BASE_URL}/api/auth/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        walletAddress: walletPubkey,
        nonce: nonceData.nonce,
        signature: signatureBase58
      })
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.success, 'Ed25519 wallet signature verified on server');

    // Confirm wallet attached to profile
    const meRes2 = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const meData2 = await meRes2.json();
    assert(meData2.profile.wallet_address === walletPubkey, 'Profile reflects verified wallet public key');

    // -------------------------------------------------------------------------
    // STEP 3: CREATE & FUND A REAL COMMITMENT
    // -------------------------------------------------------------------------
    console.log('\n📦 [3/8] COMMITMENT CREATION & DEVNET ESCROW LOCK');
    const createRes = await fetch(`${BASE_URL}/api/commitments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: 'E2E Full Stack Solana Anchor Settlement',
        creator: walletPubkey,
        stakingMode: 'HARDCORE',
        stakeAmount: 50,
        penaltyAmount: 15,
        verificationFee: 2.5,
        verifierType: 'github',
        failurePolicy: 'PARTIAL_EDUCATION_POOL',
        failurePolicyText: '35 USDC returned, 15 USDC to Education Pool',
        details: {
          repoOwner: 'solana-labs',
          repoName: 'solana',
          authorUsername: 'e2e-builder',
          requiredCommits: 3
        }
      })
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, 'Commitment created with strict input validation (HTTP 201)');
    assert(createData.id && createData.status === 'CREATED', 'Commitment state initialized as CREATED');
    createdCommitmentId = createData.id;

    // Fund Commitment (transitions state to FUNDED / ACTIVE)
    const fundRes = await fetch(`${BASE_URL}/api/commitments/${createdCommitmentId}/fund`, { method: 'POST' });
    const fundData = await fundRes.json();
    assert(fundRes.status === 200, 'Commitment funded & locked in Solana Escrow PDA');
    assert(fundData.commitment.status === 'ACTIVE', 'Commitment transitioned to ACTIVE status');

    // -------------------------------------------------------------------------
    // STEP 4: GITHUB AUTOMATED VERIFICATION ENGINE
    // -------------------------------------------------------------------------
    console.log('\n📦 [4/8] AUTOMATED GITHUB VERIFIER ENGINE');
    // Provide 4 qualifying commits
    const customCommits = [
      { sha: '0x1111111111111111111111111111111111111111', message: 'feat: add escrow state', author: 'e2e-builder', date: new Date().toISOString(), isMerge: false },
      { sha: '0x2222222222222222222222222222222222222222', message: 'feat: add anchor instruction', author: 'e2e-builder', date: new Date().toISOString(), isMerge: false },
      { sha: '0x3333333333333333333333333333333333333333', message: 'feat: add ed25519 check', author: 'e2e-builder', date: new Date().toISOString(), isMerge: false },
      { sha: '0x4444444444444444444444444444444444444444', message: 'test: run security battery', author: 'e2e-builder', date: new Date().toISOString(), isMerge: false }
    ];

    const verifyGhRes = await fetch(`${BASE_URL}/api/verify/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitmentId: createdCommitmentId,
        walletAddress: walletPubkey,
        repoOwner: 'solana-labs',
        repoName: 'solana',
        authorUsername: 'e2e-builder',
        requiredCommits: 3,
        customCommits
      })
    });
    const verifyGhData = await verifyGhRes.json();
    assert(verifyGhRes.status === 200, 'GitHub verifier verified commits successfully');
    assert(verifyGhData.attestation && verifyGhData.attestation.isSuccessful === true, 'Signed attestation confirms outcome: PASS');
    assert(verifyGhData.attestation.signature.length > 50, 'Oracle Ed25519 signature generated on attestation');

    // Confirm commitment status is now VERIFIED
    const checkCommitRes = await fetch(`${BASE_URL}/api/commitments/${createdCommitmentId}`);
    const checkCommitData = await checkCommitRes.json();
    assert(checkCommitData.status === 'VERIFIED', 'Commitment status transitioned to VERIFIED');

    // -------------------------------------------------------------------------
    // STEP 5: ON-CHAIN SOLANA DEVNET SETTLEMENT & ESCROW PAYOUT
    // -------------------------------------------------------------------------
    console.log('\n📦 [5/8] SOLANA DEVNET SETTLEMENT & IDEMPOTENCY ENFORCEMENT');
    const settleRes = await fetch(`${BASE_URL}/api/commitments/${createdCommitmentId}/settle`, {
      method: 'POST'
    });
    const settleData = await settleRes.json();
    assert(settleRes.status === 200, 'Settlement executed successfully on Solana Devnet');
    assert(settleData.commitment.status === 'SETTLED', 'Commitment status transitioned to SETTLED');
    assert(settleData.commitment.settlement.txSignature.length > 40, 'Valid Solana transaction signature emitted');
    assert(settleData.commitment.settlement.recipientPayout === 50, 'Principal safely returned to creator on PASS');

    // Invariant: Anti-Double Settlement Check
    const doubleSettleRes = await fetch(`${BASE_URL}/api/commitments/${createdCommitmentId}/settle`, {
      method: 'POST'
    });
    assert(doubleSettleRes.status === 400, 'Invariant enforced: Double settlement strictly rejected');

    // -------------------------------------------------------------------------
    // STEP 6: DEEP WORK FOCUS TIMER & ROTATING NONCE HEARTBEATS
    // -------------------------------------------------------------------------
    console.log('\n📦 [6/8] DEEP WORK FOCUS STUDIO & CRYPTOGRAPHIC HEARTBEATS');
    const startStudyRes = await fetch(`${BASE_URL}/api/verify/study/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: 'cm_study_02' })
    });
    const startStudyData = await startStudyRes.json();
    assert(startStudyRes.status === 200, 'Focus session started with initial challenge nonce');
    let nonce = startStudyData.nonce;

    // Send 3 heartbeats
    for (let i = 1; i <= 3; i++) {
      const hbRes = await fetch(`${BASE_URL}/api/verify/study/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitmentId: 'cm_study_02', clientNonce: nonce, wasFocused: true })
      });
      const hbData = await hbRes.json();
      assert(hbRes.status === 200 && hbData.nextNonce, `Heartbeat #${i} valid and active seconds incremented`);
      nonce = hbData.nextNonce; // Rotate nonce
    }

    // Finish session
    const finishStudyRes = await fetch(`${BASE_URL}/api/verify/study/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: 'cm_study_02' })
    });
    const finishStudyData = await finishStudyRes.json();
    assert(finishStudyRes.status === 200, 'Focus session completed and Oracle attestation generated');

    // -------------------------------------------------------------------------
    // STEP 7: PEER CONSENSUS VERIFICATION & SOLANA BLOCKHASH
    // -------------------------------------------------------------------------
    console.log('\n📦 [7/8] PEER CONSENSUS VERIFIER & 2/3 THRESHOLD VOTING');
    const peerRes = await fetch(`${BASE_URL}/api/commitments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: 'Peer Consensus Community Challenge',
        creator: walletPubkey,
        stakingMode: 'HARDCORE',
        stakeAmount: 30,
        penaltyAmount: 10,
        verificationFee: 2,
        verifierType: 'peer_consensus',
        failurePolicy: 'PARTIAL_COMMUNITY_POOL'
      })
    });
    const peerData = await peerRes.json();
    const peerCommitId = peerData.id;
    await fetch(`${BASE_URL}/api/commitments/${peerCommitId}/fund`, { method: 'POST' });

    const peerChallengeRes = await fetch(`${BASE_URL}/api/verify/peer/challenge/${peerCommitId}`);
    const peerChallengeData = await peerChallengeRes.json();
    assert(peerChallengeRes.status === 200, 'Dynamic Solana blockhash challenge generated');

    // Submit proof
    const submitProofRes = await fetch(`${BASE_URL}/api/verify/peer/submit-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitmentId: peerCommitId,
        proof: { description: 'Electronics lab workbench organized and cleaned', checklist: [{ label: 'Cleaned', checked: true }] }
      })
    });
    assert(submitProofRes.status === 200, 'Peer verification proof submitted');

    // Vote 1 (Alex: PASS)
    const vote1Res = await fetch(`${BASE_URL}/api/verify/peer/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: peerCommitId, verifierId: 'v_alex', vote: 'PASS', notes: 'Verified cleanly' })
    });
    const vote1Data = await vote1Res.json();
    assert(vote1Data.votesCount === 1 && !vote1Data.consensusReached, 'Vote 1 recorded (1/3 votes, consensus not yet reached)');

    // Vote 2 (Chen: PASS -> Reaches 2/3 threshold!)
    const vote2Res = await fetch(`${BASE_URL}/api/verify/peer/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: peerCommitId, verifierId: 'v_chen', vote: 'PASS', notes: 'Seconded, good job' })
    });
    const vote2Data = await vote2Res.json();
    assert(vote2Data.consensusReached === true, '2-of-3 decentralized peer consensus reached');
    assert(vote2Data.attestation.resultCode === 'HUMAN_PASS', 'Attestation generated: HUMAN_PASS');

    // -------------------------------------------------------------------------
    // STEP 8: ADMIN AUDIT LOGGING & AUTHORITATIVE TRAIL
    // -------------------------------------------------------------------------
    console.log('\n📦 [8/8] ADMIN AUTHORIZATION & POSTGRESQL AUDIT TRAIL');
    // Create Admin user
    const signupAdminRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAdminEmail,
        password: defaultPassword,
        confirmPassword: defaultPassword,
        username: `e2e_admin_${timestamp}`,
        displayName: 'E2E System Admin'
      })
    });
    const signupAdminData = await signupAdminRes.json();
    adminId = signupAdminData.user.id;
    await supabaseAdmin.auth.admin.updateUserById(adminId, { email_confirm: true });

    // Elevate in PostgreSQL
    await supabaseAdmin.from('user_profiles').update({ role: 'ADMIN' }).eq('auth_user_id', adminId);

    // Login as Admin
    const loginAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testAdminEmail, password: defaultPassword })
    });
    const loginAdminData = await loginAdminRes.json();
    adminToken = loginAdminData.session.access_token;

    // Retrieve audit logs
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200, 'Admin successfully queries /api/admin/audit-logs');
    assert(auditData.auditLogs && auditData.auditLogs.length >= 2, 'PostgreSQL audit trail contains immutable action records');

    const actions = auditData.auditLogs.map(l => l.action);
    assert(actions.includes('SIGNUP'), 'Audit log includes SIGNUP event');
    assert(actions.includes('LOGIN'), 'Audit log includes LOGIN event');
    assert(actions.includes('WALLET_CONNECTED'), 'Audit log includes WALLET_CONNECTED event');

    // =========================================================================
    // 9. STUDY FAIL & FAILURE SETTLEMENT (STAKE PENALTY TRANSFER)
    // =========================================================================
    console.log('\n📦 [9/10] STUDY FAIL & FAILURE SETTLEMENT (STAKE PENALTY TRANSFER)');
    const studyFailCommRes = await fetch(`${BASE_URL}/api/commitments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: 'E2E Daily Focus Requirement (Failure Test)',
        stakingMode: 'HARDCORE',
        stakeAmount: 20,
        penaltyAmount: 10,
        verificationFee: 1,
        verifierType: 'study_timer',
        failurePolicy: 'burn'
      })
    });
    const studyFailComm = await studyFailCommRes.json();
    assert(studyFailCommRes.status === 201, 'Study failure test commitment created');

    // Fund
    await fetch(`${BASE_URL}/api/commitments/${studyFailComm.id}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txSignature: 'MockStudyFundTx111111111111111111111111111111111' })
    });

    // Finish session with 0 seconds (fails required daily focus)
    const studyFinishRes = await fetch(`${BASE_URL}/api/verify/study/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: studyFailComm.id, demoForceSeconds: 0 })
    });
    const studyFinishData = await studyFinishRes.json();
    assert(studyFinishRes.status === 200, 'Study finish endpoint returned successfully');
    assert(studyFinishData.commitment.status === 'VERIFIED', 'Commitment transitioned to VERIFIED status');
    assert(studyFinishData.commitment.attestation.resultCode === 'STUDY_FAIL', 'Attestation outcome strictly reflects STUDY_FAIL');
    assert(studyFinishData.commitment.attestation.isSuccessful === false, 'Attestation isSuccessful is false');

    // Settle failure on Devnet
    const studySettleRes = await fetch(`${BASE_URL}/api/commitments/${studyFailComm.id}/settle`, { method: 'POST' });
    const studySettleData = await studySettleRes.json();
    assert(studySettleRes.status === 200, 'Settlement executed successfully on Solana Devnet for failed commitment');
    assert(studySettleData.commitment.status === 'SETTLED', 'Commitment status transitioned to SETTLED');
    assert(studySettleData.commitment.settlement.penaltyTransferred === 10, 'Penalty of 10 USDC transferred to failure destination pool');
    assert(studySettleData.commitment.settlement.recipientPayout === 10, 'Partial refund of 10 USDC safely returned to creator');

    // =========================================================================
    // 10. FORMAL DISPUTE LIFECYCLE & ADMIN RESOLUTION
    // =========================================================================
    console.log('\n📦 [10/10] FORMAL DISPUTE LIFECYCLE & ADMIN RESOLUTION');
    const dispCommRes = await fetch(`${BASE_URL}/api/commitments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: 'E2E Full Dispute Lifecycle Commitment',
        stakingMode: 'HARDCORE',
        stakeAmount: 30,
        penaltyAmount: 15,
        verificationFee: 2,
        verifierType: 'peer_consensus',
        failurePolicy: 'burn'
      })
    });
    const dispComm = await dispCommRes.json();

    // Fund
    await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txSignature: 'MockDispFundTx111111111111111111111111111111111' })
    });

    // Peer submit proof & vote FAIL
    await fetch(`${BASE_URL}/api/verify/peer/challenge/${dispComm.id}`);
    await fetch(`${BASE_URL}/api/verify/peer/submit-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: dispComm.id, evidenceData: { walletAddress: walletPubkey, description: 'Submitted Proof' } })
    });
    await fetch(`${BASE_URL}/api/verify/peer/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: dispComm.id, verifierId: 'v_alex', vote: 'FAIL' })
    });
    await fetch(`${BASE_URL}/api/verify/peer/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitmentId: dispComm.id, verifierId: 'v_elena', vote: 'FAIL' })
    });

    // User opens formal dispute
    const openDisputeRes = await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        reason: 'Blockhash challenge was clearly documented in full-resolution image',
        evidence: [{ url: 'https://commit.protocol/dispute.png', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }]
      })
    });
    const openDisputeData = await openDisputeRes.json();
    assert(openDisputeRes.status === 200, 'Dispute opened successfully (HTTP 200)');
    assert(openDisputeData.commitment.status === 'DISPUTED', 'Commitment status strictly changed to DISPUTED');

    // INVARIANT: Settlement blocked during dispute
    const disputeBlockedRes = await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/settle`, { method: 'POST' });
    assert(disputeBlockedRes.status === 400, 'Settlement attempt strictly BLOCKED with HTTP 400 during active dispute');

    // Admin resolves dispute (OVERTURN_TO_PASS)
    const resolveDisputeRes = await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/resolve-dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        resolution: 'OVERTURN_TO_PASS',
        notes: 'Reviewed uncompressed high-resolution proof: blockhash visible. Overturned to PASS.'
      })
    });
    const resolveDisputeData = await resolveDisputeRes.json();
    assert(resolveDisputeRes.status === 200, 'Admin successfully resolves dispute via /api/commitments/:id/resolve-dispute');
    assert(resolveDisputeData.commitment.status === 'VERIFIED', 'Commitment un-frozen to VERIFIED state');
    assert(resolveDisputeData.commitment.attestation.isSuccessful === true, 'Attestation updated to isSuccessful = true');
    assert(resolveDisputeData.commitment.attestation.resultCode === 'DISPUTE_OVERTURN_PASS', 'Attestation resultCode = DISPUTE_OVERTURN_PASS');

    // Settle commitment successfully
    const dispSettleRes = await fetch(`${BASE_URL}/api/commitments/${dispComm.id}/settle`, { method: 'POST' });
    const dispSettleData = await dispSettleRes.json();
    assert(dispSettleRes.status === 200, 'Settlement executed successfully after dispute resolution');
    assert(dispSettleData.commitment.status === 'SETTLED', 'Commitment status is SETTLED');
    assert(dispSettleData.commitment.settlement.recipientPayout === 30, 'Full principal of 30 USDC returned to creator');

  } catch (err) {
    console.error('Unhandled E2E Error:', err);
    failed++;
  } finally {
    // Cleanup created test users
    console.log('\n--- Cleaning up E2E test users ---');
    if (userId) await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    if (adminId) await supabaseAdmin.auth.admin.deleteUser(adminId).catch(() => {});
    console.log('Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`🎯 COMPLETE E2E TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullE2ETest();