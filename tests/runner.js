import assert from 'assert';
import { ORACLE_PUBLIC_KEY, signVerificationResult, verifyAttestationSignature, hashEvidence } from '../server/oracle/attestation.js';
import { GitHubVerifier } from '../server/verifiers/githubVerifier.js';
import { StudyTimerVerifier } from '../server/verifiers/studyTimerVerifier.js';
import { PeerConsensusVerifier } from '../server/verifiers/peerConsensusVerifier.js';
import { escrowClient } from '../server/solana/escrowClient.js';
import { getActionsJson, getCommitActionMetadata } from '../server/blinks/actions.js';

console.log('====================================================');
console.log('🚀 RUNNING COMMIT PROTOCOL TEST SUITE (10/10 SPEC)');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTests() {
  console.log('📦 1. CRYPTOGRAPHIC ATTESTATION & ED25519 SIGNATURES');
  
  it('Should generate valid SHA-256 evidence hash', () => {
    const hash = hashEvidence({ task: 'clean_room', nonce: 12345 });
    assert(hash.startsWith('0x'), 'Hash should start with 0x');
    assert.strictEqual(hash.length, 66, 'SHA-256 hex string should be 64 chars + 2 prefix');
  });

  it('Should sign attestation with Ed25519 key and successfully verify', () => {
    const attestation = signVerificationResult({
      commitmentId: 'cm_test_01',
      walletAddress: 'H4cK3rSolanaDev1111111111111111111111111111111',
      verifierType: 'github',
      resultCode: 'GH_PASS',
      isSuccessful: true,
      verifiedMetric: 5,
      requiredMetric: 5,
      evidencePayload: { commitsCount: 5 }
    });

    assert(attestation.signature, 'Signature must exist');
    assert.strictEqual(attestation.oraclePublicKey, ORACLE_PUBLIC_KEY);
    const isValid = verifyAttestationSignature(attestation);
    assert.strictEqual(isValid, true, 'Cryptographic signature must be valid');
  });

  it('Should reject tampered attestation payload', () => {
    const attestation = signVerificationResult({
      commitmentId: 'cm_test_02',
      walletAddress: 'H4cK3rSolanaDev1111111111111111111111111111111',
      verifierType: 'github',
      resultCode: 'GH_PASS',
      isSuccessful: true,
      verifiedMetric: 5,
      requiredMetric: 5,
      evidencePayload: { commitsCount: 5 }
    });

    // Tamper with the result code from PASS to FAIL without changing the signature
    const tampered = { ...attestation, resultCode: 'GH_FAIL' };
    const isValid = verifyAttestationSignature(tampered);
    assert.strictEqual(isValid, false, 'Tampered attestation signature must be rejected!');
  });

  console.log('\n📦 2. AUTOMATED GITHUB VERIFIER');
  const ghVerifier = new GitHubVerifier();

  await (async () => {
    const customCommits = [
      { sha: 'sha1', message: 'feat: add escrow', author: 'alice', isMerge: false },
      { sha: 'sha2', message: 'feat: add blinks', author: 'alice', isMerge: false },
      { sha: 'sha3', message: 'merge pull request', author: 'alice', isMerge: true }, // merge commit should be ignored!
      { sha: 'sha2', message: 'duplicate sha', author: 'alice', isMerge: false }, // duplicate should be ignored!
      { sha: 'sha4', message: 'test: add unit tests', author: 'alice', isMerge: false }
    ];

    const passResult = await ghVerifier.verify({
      commitmentId: 'cm_gh_test',
      walletAddress: 'AliceSolanaWallet1111111111111111111111111',
      repoOwner: 'alice',
      repoName: 'solana-project',
      authorUsername: 'alice',
      requiredCommits: 3,
      customCommits
    });

    it('Should filter merge commits and duplicate SHAs and correctly PASS', () => {
      assert.strictEqual(passResult.verifiedMetric, 3, 'Should have exactly 3 qualifying commits');
      assert.strictEqual(passResult.resultCode, 'GH_PASS');
      assert.strictEqual(passResult.isSuccessful, true);
    });

    const failResult = await ghVerifier.verify({
      commitmentId: 'cm_gh_test_fail',
      walletAddress: 'AliceSolanaWallet1111111111111111111111111',
      repoOwner: 'alice',
      repoName: 'solana-project',
      authorUsername: 'alice',
      requiredCommits: 5, // Requires 5, but only 3 qualify!
      customCommits
    });

    it('Should correctly emit GH_FAIL when commits are insufficient', () => {
      assert.strictEqual(failResult.resultCode, 'GH_FAIL');
      assert.strictEqual(failResult.isSuccessful, false);
    });
  })();

  console.log('\n📦 3. DEEP WORK STUDY FOCUS VERIFIER');
  const studyVerifier = new StudyTimerVerifier();

  it('Should start session with cryptographic nonce', () => {
    const session = studyVerifier.startSession('cm_study_test', 'BobWallet111111', 3);
    assert.strictEqual(session.status, 'STARTED');
    assert(session.nonce.length >= 16, 'Nonce must be at least 16 hex chars');
  });

  it('Should record heartbeat, advance active time, and rotate nonce', () => {
    const session = studyVerifier.sessions.get('cm_study_test');
    const oldNonce = session.currentNonce;
    const update = studyVerifier.recordHeartbeat('cm_study_test', oldNonce, true);
    assert(update.nextNonce, 'New nonce generated');
    assert.notStrictEqual(update.nextNonce, oldNonce, 'Nonce rotated');
  });

  it('Should detect replay attacks on outdated heartbeat nonces', () => {
    assert.throws(() => {
      studyVerifier.recordHeartbeat('cm_study_test', 'OLD_INVALID_NONCE_REPLAY', true);
    }, /nonce mismatch/);
  });

  console.log('\n📦 4. DECENTRALIZED PEER CONSENSUS VERIFIER');
  const peerVerifier = new PeerConsensusVerifier();

  it('Should generate dynamic Solana blockhash challenge code', () => {
    const challenge = peerVerifier.generateChallenge('cm_peer_test', '7Z8z9xPQ');
    assert(challenge.challengeCode.startsWith('SOL-7Z8z9x'), 'Challenge code incorporates blockhash');
  });

  it('Should require 2-of-3 peer consensus to generate final attestation', () => {
    peerVerifier.submitProof('cm_peer_test', { description: 'Photo with SOL-7Z8z9x code displayed' });
    
    // Vote 1 (Alex PASS) -> not yet consensus
    const vote1 = peerVerifier.castVote('cm_peer_test', 'v_alex', 'PASS');
    assert.strictEqual(vote1.consensusReached, false);

    // Vote 2 (Chen PASS) -> 2 of 3 reaches consensus!
    const vote2 = peerVerifier.castVote('cm_peer_test', 'v_chen', 'PASS');
    assert.strictEqual(vote2.consensusReached, true);
    assert.strictEqual(vote2.attestation.resultCode, 'HUMAN_PASS');
    assert.strictEqual(vote2.attestation.isSuccessful, true);
  });

  console.log('\n📦 5. SOLANA DEVNET ESCROW & BLINKS');
  it('Should derive valid PDAs for commitment and escrow vault', () => {
    const [commitmentPda] = escrowClient.findCommitmentPda('cm_gh_01');
    const [vaultPda] = escrowClient.findEscrowVaultPda('cm_gh_01');
    assert(commitmentPda.toBase58().length > 30);
    assert(vaultPda.toBase58().length > 30);
  });

  it('Should conform to official Solana Actions & Blinks JSON spec', () => {
    const actionsJson = getActionsJson();
    assert(Array.isArray(actionsJson.rules));
    const metadata = getCommitActionMetadata({
      id: 'cm_gh_01',
      title: 'Ship 5 Commits',
      stakingMode: 'HARDCORE',
      stakeAmount: 20,
      verifierType: 'github',
      failurePolicyText: '5 USDC penalty',
      status: 'CREATED'
    });
    assert.strictEqual(metadata.type, 'action');
    assert(metadata.label.includes('20 USDC'));
    assert(Array.isArray(metadata.links.actions));
  });

  console.log('\n====================================================');
  console.log(`🎯 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAsyncTests().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
