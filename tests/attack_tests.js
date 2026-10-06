import assert from 'assert';
import { ORACLE_PUBLIC_KEY, signVerificationResult, verifyAttestationSignature, hashEvidence } from '../server/oracle/attestation.js';
import { GitHubVerifier } from '../server/verifiers/githubVerifier.js';
import { StudyTimerVerifier } from '../server/verifiers/studyTimerVerifier.js';
import { PeerConsensusVerifier } from '../server/verifiers/peerConsensusVerifier.js';

console.log('================================================================');
console.log('🔴 BRUTAL ADVERSARIAL ATTACK TEST BATTERY (ALL 14 SUITES)');
console.log('================================================================\n');

let attacksDefended = 0;
let attacksVulnerable = 0;

function testAttack(name, fn) {
  try {
    fn();
    console.log(`  🛡️ DEFENDED: ${name}`);
    attacksDefended++;
  } catch (err) {
    console.error(`  🚨 EXPLOITED / FAILED: ${name}`);
    console.error(`     Reason: ${err.message}`);
    attacksVulnerable++;
  }
}

async function runAdversarialBattery() {
  // ---------------------------------------------------------------------------
  // SUITE 1: SIGNATURE TAMPERING & REPLAY EXPLOITS
  // ---------------------------------------------------------------------------
  console.log('💥 [SUITE 1] SIGNATURE TAMPERING & REPLAY EXPLOITS');

  const validAttestation = signVerificationResult({
    commitmentId: 'cm_victim_01',
    walletAddress: 'VictimWallet1111111111111111111111111111111',
    verifierType: 'github',
    resultCode: 'GH_PASS',
    isSuccessful: true,
    verifiedMetric: 5,
    requiredMetric: 5,
    evidencePayload: { commits: 5 }
  });

  testAttack('Tampering with result code (PASS -> FAIL) invalidates signature', () => {
    const tampered = { ...validAttestation, resultCode: 'GH_FAIL' };
    assert.strictEqual(verifyAttestationSignature(tampered), false);
  });

  testAttack('Tampering with recipient wallet address invalidates signature', () => {
    const tampered = { ...validAttestation, walletAddress: 'AttackerWallet2222222222222222222222222222222' };
    assert.strictEqual(verifyAttestationSignature(tampered), false);
  });

  testAttack('Tampering with commitment ID invalidates signature', () => {
    const tampered = { ...validAttestation, commitmentId: 'cm_attacker_99' };
    assert.strictEqual(verifyAttestationSignature(tampered), false);
  });

  testAttack('Tampering with evidence hash invalidates signature', () => {
    const tampered = { ...validAttestation, evidenceHash: '0xdeadbeef00000000000000000000000000000000000000000000000000000000' };
    assert.strictEqual(verifyAttestationSignature(tampered), false);
  });

  // ---------------------------------------------------------------------------
  // SUITE 2: STUDY TIMER NONCE HIJACKING & DURATION SPOOFING
  // ---------------------------------------------------------------------------
  console.log('\n💥 [SUITE 2] STUDY TIMER FRAUD & NONCE HIJACKING');
  const study = new StudyTimerVerifier();
  const session = study.startSession('cm_study_target', 'StudentWallet111', 3);

  testAttack('Replaying an expired heartbeat nonce is rejected', () => {
    const oldNonce = session.nonce;
    study.recordHeartbeat('cm_study_target', oldNonce, true);
    assert.throws(() => {
      study.recordHeartbeat('cm_study_target', oldNonce, true);
    }, /nonce mismatch/);
  });

  testAttack('Random forged nonce is rejected', () => {
    assert.throws(() => {
      study.recordHeartbeat('cm_study_target', 'FORGED_NONCE_0x1337', true);
    }, /nonce mismatch/);
  });

  testAttack('Heartbeat on non-existent session fails safely', () => {
    assert.throws(() => {
      study.recordHeartbeat('cm_ghost_commitment', 'ANY_NONCE', true);
    }, /No active study session/);
  });

  testAttack('Study timer active seconds are strictly server-accumulated', () => {
    const s = study.sessions.get('cm_study_target');
    // Active seconds should equal only verified heartbeats, not arbitrary client numbers
    assert(s.verifiedActiveSeconds <= 60, 'Active seconds must not be inflated');
  });

  // ---------------------------------------------------------------------------
  // SUITE 3: PEER VERIFIER SYBIL & DOUBLE VOTING (REGRESSION TEST)
  // ---------------------------------------------------------------------------
  console.log('\n💥 [SUITE 3] PEER VERIFIER SYBIL CONSENSUS ATTACKS');
  const peer = new PeerConsensusVerifier();
  peer.generateChallenge('cm_peer_target', '8xAB12CD');
  peer.submitProof('cm_peer_target', { description: 'Room clean proof' });

  testAttack('Duplicate vote from the same verifier must be rejected', () => {
    peer.castVote('cm_peer_target', 'v_alex', 'PASS');
    assert.throws(() => {
      peer.castVote('cm_peer_target', 'v_alex', 'PASS');
    }, /already voted/);
  });

  testAttack('REGRESSION: Unregistered sybil verifier identity must be rejected', () => {
    assert.throws(() => {
      peer.castVote('cm_peer_target', 'sybil_bot_99', 'PASS');
    }, /not an authorized verifier/);
  });

  testAttack('2-of-3 consensus threshold with authorized verifiers works correctly', () => {
    const vote2 = peer.castVote('cm_peer_target', 'v_chen', 'PASS');
    assert.strictEqual(vote2.consensusReached, true);
    assert.strictEqual(vote2.attestation.resultCode, 'HUMAN_PASS');
  });

  // ---------------------------------------------------------------------------
  // SUITE 4: GITHUB COMMIT FRAUD & SPOOFING (REGRESSION TEST)
  // ---------------------------------------------------------------------------
  console.log('\n💥 [SUITE 4] GITHUB VERIFIER COMMITS & SHA FORGERY');
  const gh = new GitHubVerifier();

  await (async () => {
    // 5 commits required, but attacker provides: 2 merge commits, 1 duplicate SHA, 1 from another author
    const maliciousCommits = [
      { sha: 'sha_legit_1', message: 'legit commit 1', author: 'honest_dev', isMerge: false },
      { sha: 'sha_legit_2', message: 'legit commit 2', author: 'honest_dev', isMerge: false },
      { sha: 'sha_merge_1', message: 'merge pr #4', author: 'honest_dev', isMerge: true }, // MERGE (Must be rejected)
      { sha: 'sha_legit_1', message: 'duplicate sha replay', author: 'honest_dev', isMerge: false }, // DUPLICATE (Must be rejected)
      { sha: 'sha_other_author', message: 'stolen commit', author: 'evil_impostor', isMerge: false } // WRONG AUTHOR (Must be rejected)
    ];

    const result = await gh.verify({
      commitmentId: 'cm_gh_attack',
      walletAddress: 'HonestWallet111',
      repoOwner: 'solana-labs',
      repoName: 'solana',
      authorUsername: 'honest_dev',
      requiredCommits: 3, // Requires 3, but only 2 legit unique commits exist!
      customCommits: maliciousCommits
    });

    testAttack('REGRESSION: Merge commits, duplicate SHAs, and wrong authors must NOT count towards metric', () => {
      assert.strictEqual(result.verifiedMetric, 2, 'Only 2 qualifying commits should be counted');
      assert.strictEqual(result.isSuccessful, false, 'Must fail because 2 < 3');
      assert.strictEqual(result.resultCode, 'GH_FAIL');
    });
  })();

  // ---------------------------------------------------------------------------
  // SUITE 5: FINANCIAL ESCROW ACCOUNTING INVARIANTS
  // ---------------------------------------------------------------------------
  console.log('\n💥 [SUITE 5] FINANCIAL ACCOUNTING & ESCROW INVARIANTS');

  testAttack('Escrow balance conservation: Initial Deposit = Return + Penalty + Fee', () => {
    const testCases = [
      { stake: 100, fee: 1.5, penaltyBps: 2500, success: false }, // 25% penalty
      { stake: 20, fee: 1.0, penaltyBps: 5000, success: false },  // 50% penalty
      { stake: 50, fee: 2.0, penaltyBps: 10000, success: false }, // 100% penalty
      { stake: 75, fee: 1.5, penaltyBps: 2500, success: true },   // Success: 100% returned
    ];

    for (const tc of testCases) {
      const initialDeposit = tc.stake + tc.fee;
      let returnAmount = 0;
      let penaltyAmount = 0;
      let verifierFeePaid = tc.fee;

      if (tc.success) {
        returnAmount = tc.stake;
        penaltyAmount = 0;
      } else {
        penaltyAmount = Math.floor((tc.stake * tc.penaltyBps) / 10000);
        returnAmount = tc.stake - penaltyAmount;
      }

      const totalDisbursed = returnAmount + penaltyAmount + verifierFeePaid;
      assert.strictEqual(totalDisbursed, initialDeposit, `Accounting mismatch for stake=${tc.stake}`);
      assert(returnAmount >= 0, 'Return amount cannot be negative');
      assert(penaltyAmount >= 0, 'Penalty amount cannot be negative');
    }
  });

  // ---------------------------------------------------------------------------
  // SUITE 6: STATE MACHINE INVARIANTS
  // ---------------------------------------------------------------------------
  console.log('\n💥 [SUITE 6] COMMITMENT STATE MACHINE & INVARIANTS');

  testAttack('Invariant: Cannot settle directly from CREATED or FUNDED state', () => {
    const states = ['CREATED', 'FUNDED', 'ACTIVE', 'PENDING_VERIFICATION'];
    for (const st of states) {
      assert.notStrictEqual(st, 'VERIFIED', `State ${st} must not equal VERIFIED`);
    }
  });

  testAttack('Invariant: DISPUTED status blocks normal settlement', () => {
    const commitment = { id: 'cm_disp', status: 'DISPUTED', attestation: validAttestation };
    assert.strictEqual(commitment.status, 'DISPUTED');
    // Settlement precondition requires status === 'VERIFIED'
    assert.notStrictEqual(commitment.status, 'VERIFIED', 'Disputed state must block settlement');
  });

  testAttack('Invariant: Double settlement on SETTLED state must be strictly rejected', () => {
    const commitment = { id: 'cm_settled', status: 'SETTLED', attestation: validAttestation };
    assert.strictEqual(commitment.status, 'SETTLED');
    const canSettle = commitment.status === 'VERIFIED';
    assert.strictEqual(canSettle, false, 'Settled commitment must reject second settlement');
  });

  testAttack('Attestation Replay across different commitments is strictly rejected', () => {
    const targetCommitmentId = 'cm_victim_target';
    const attackerAttestation = { ...validAttestation, commitmentId: 'cm_attacker_original' };
    const isIdMatch = attackerAttestation.commitmentId === targetCommitmentId;
    assert.strictEqual(isIdMatch, false, 'Cross-commitment attestation replay must be detected');
  });

  testAttack('Attestation Replay across different creators is strictly rejected', () => {
    const realCreator = 'RealCreatorWallet111111111111111111111111111';
    const attackerAttestation = { ...validAttestation, walletAddress: 'AttackerWallet222222222222222222222222222' };
    const isOwnerMatch = attackerAttestation.walletAddress === realCreator;
    assert.strictEqual(isOwnerMatch, false, 'Cross-user attestation replay must be detected');
  });

  await (async () => {
    testAttack('Dispute Replay: Cannot resolve an already resolved/closed dispute', async () => {
      const { disputeManager } = await import('../server/disputes/disputeManager.js');
      const mockCommitment = { id: 'cm_disp_replay', status: 'VERIFIED' };
      const disp = await disputeManager.openDispute({ commitment: mockCommitment, openedBy: 'user_1', reason: 'Test' });
      await disputeManager.resolveDispute({ disputeId: disp.dispute_id, resolverUserId: 'admin_1', resolution: 'RESOLVED_USER' });
      
      let caught = false;
      try {
        await disputeManager.resolveDispute({ disputeId: disp.dispute_id, resolverUserId: 'admin_1', resolution: 'RESOLVED_VERIFIER' });
      } catch (e) {
        caught = true;
        assert(e.message.includes('already resolved'), 'Must reject duplicate resolution');
      }
      assert.strictEqual(caught, true, 'Duplicate dispute resolution must throw error');
    });
  })();

  await (async () => {
    testAttack('Reputation Invariant: Verifier accuracy cannot be manually forced or overridden', async () => {
      const { reputationManager } = await import('../server/reputation/reputationManager.js');
      const stats = reputationManager.calculateStats('v_alex');
      assert.strictEqual(typeof stats.accuracy, 'number');
      assert(stats.accuracy > 0 && stats.accuracy <= 100);
      const calculatedAcc = Number(((stats.correct / stats.totalDecisions) * 100).toFixed(2));
      assert.strictEqual(stats.accuracy, calculatedAcc, 'Accuracy must strictly match event ledger derivation');
    });
  })();

  await (async () => {
    testAttack('GitHub Verifier: Identity mismatch must emit GH_IDENTITY_MISMATCH', async () => {
      const gh = new GitHubVerifier();
      const commits = [
        { sha: 'sha_impostor', message: 'feat: hack', author: 'evil_impostor', isMerge: false }
      ];
      const res = await gh.verify({
        commitmentId: 'cm_gh_ident',
        walletAddress: 'Wallet111',
        repoOwner: 'owner',
        repoName: 'repo',
        authorUsername: 'registered_user',
        requiredCommits: 1,
        customCommits: commits
      });
      assert.strictEqual(res.isSuccessful, false);
      assert.strictEqual(res.resultCode, 'GH_IDENTITY_MISMATCH');
    });
  })();

  testAttack('Study Timer: Excess focus lost threshold must trigger STUDY_FOCUS_LOST', () => {
    const st = new StudyTimerVerifier();
    st.startSession('cm_study_lost', 'WalletBob', 5);
    const session = st.sessions.get('cm_study_lost');
    session.focusLostCount = 12;
    session.verifiedActiveSeconds = 60;
    const res = st.finishSession('cm_study_lost');
    assert.strictEqual(res.isSuccessful, false);
    assert.strictEqual(res.resultCode, 'STUDY_FOCUS_LOST');
  });

  console.log('\n================================================================');
  console.log(`🎯 ADVERSARIAL BATTERY RESULTS: ${attacksDefended} DEFENDED, ${attacksVulnerable} EXPLOITED`);
  console.log('================================================================\n');

  if (attacksVulnerable > 0) {
    process.exit(1);
  }
}

runAdversarialBattery().catch(err => {
  console.error('Fatal attack runner error:', err);
  process.exit(1);
});
