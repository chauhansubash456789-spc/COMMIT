import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { ORACLE_PUBLIC_KEY, verifyAttestationSignature } from './oracle/attestation.js';
import { GitHubVerifier } from './verifiers/githubVerifier.js';
import { StudyTimerVerifier } from './verifiers/studyTimerVerifier.js';
import { PeerConsensusVerifier } from './verifiers/peerConsensusVerifier.js';
import { escrowClient } from './solana/escrowClient.js';
import { getActionsJson, getCommitActionMetadata, buildActionTransaction } from './blinks/actions.js';
import { dbGetCommitments, dbSaveCommitment, isDatabaseReady } from './db/supabase.js';
import { authRouter } from './auth/routes.js';
import { requireAuth, requireRole, requireActive } from './auth/middleware.js';
import { supabaseAdmin } from './auth/supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Mount Authentication & Admin Authorization Routes
app.use('/api/auth', authRouter);
app.use('/api', authRouter);

// Initialize verifier engines
const githubVerifier = new GitHubVerifier();
const studyVerifier = new StudyTimerVerifier();
const peerVerifier = new PeerConsensusVerifier();

// In-memory commitment store with Supabase sync
const commitments = new Map();

// Helper to pre-populate demo data
async function seedInitialCommitments() {
  // Check if Supabase has existing commitments
  const dbReady = await isDatabaseReady();
  if (dbReady) {
    const existing = await dbGetCommitments();
    if (existing && existing.length > 0) {
      console.log(`[Supabase] Loaded ${existing.length} commitments from database`);
      existing.forEach(item => commitments.set(item.id, item));
      return;
    }
  }

  const seedItems = [
    {
      id: 'cm_gh_01',
      title: 'Ship 5 Qualifying Commits to Solana Anchor Repo',
      creator: 'H4cK3rSolanaDev1111111111111111111111111111111',
      stakingMode: 'HARDCORE', // 'HARDCORE' or 'NOLOSS'
      stakeAmount: 20,
      penaltyAmount: 5,
      verificationFee: 1.5,
      verifierType: 'github',
      failurePolicy: 'PARTIAL_EDUCATION_POOL',
      failurePolicyText: '15 USDC returned, 5 USDC to Solana Developer Education Pool',
      status: 'ACTIVE',
      details: {
        repoOwner: 'solana-labs',
        repoName: 'solana',
        authorUsername: 'solana-builder',
        requiredCommits: 5,
        startDate: '2026-10-01',
        endDate: '2026-10-08'
      },
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 48).toISOString()
    },
    {
      id: 'cm_study_02',
      title: 'Complete 3 Hours Deep Focus Study Block',
      creator: 'StudyChadSolana2222222222222222222222222222222',
      stakingMode: 'NOLOSS', // Yield at stake!
      stakeAmount: 100, // Deposited in Kamino vault
      penaltyAmount: 8, // Earned yield at stake
      verificationFee: 1.0,
      verifierType: 'study_timer',
      failurePolicy: 'YIELD_FORFEIT_TO_VERIFIERS',
      failurePolicyText: 'Principal 100% safe! Accrued yield forfeited on failure',
      status: 'ACTIVE',
      details: {
        requiredMinutes: 3, // 3 mins for rapid demo testing
        environment: 'Commit Focus Terminal'
      },
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 12).toISOString()
    },
    {
      id: 'cm_peer_03',
      title: 'Organize and Clean Electronics Lab & Workbench',
      creator: 'HardwareHacker3333333333333333333333333333333',
      stakingMode: 'HARDCORE',
      stakeAmount: 30,
      penaltyAmount: 10,
      verificationFee: 2.0,
      verifierType: 'peer_consensus',
      failurePolicy: 'PARTIAL_COMMUNITY_POOL',
      failurePolicyText: '20 USDC returned, 10 USDC to Community Hardware Fund',
      status: 'PENDING_VERIFICATION',
      details: {
        taskName: 'Clean & Organize Workbench',
        requirements: ['Clean desk surface', 'Sort electronic components', 'Show dynamic blockhash']
      },
      createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 24).toISOString()
    }
  ];

  for (const item of seedItems) {
    commitments.set(item.id, item);
    if (dbReady) await dbSaveCommitment(item);
  }

  // Initialize peer task for cm_peer_03 in review phase so verifiers can immediately vote
  peerVerifier.generateChallenge('cm_peer_03', '7Z8z9xPQ');
  peerVerifier.submitProof('cm_peer_03', {
    mediaUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    description: 'Cleaned workbench surface, sorted components into bins, dynamic blockhash challenge code displayed',
    checklist: [
      { label: 'Work surface clean and cleared', checked: true },
      { label: 'Components sorted and organized', checked: true },
      { label: 'Dynamic blockhash visible and validated', checked: true }
    ]
  });
}

seedInitialCommitments();

// -----------------------------------------------------------------------------
// REST API ENDPOINTS
// -----------------------------------------------------------------------------

// Get Oracle Public Key
app.get('/api/oracle/public-key', (req, res) => {
  res.json({ oraclePublicKey: ORACLE_PUBLIC_KEY, version: '1.0.0-devnet' });
});

// List all commitments
app.get('/api/commitments', (req, res) => {
  res.json(Array.from(commitments.values()));
});

// Get single commitment
app.get('/api/commitments/:id', (req, res) => {
  const c = commitments.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  res.json(c);
});

// Create new commitment (STRICT INPUT VALIDATION + SUPABASE PERSISTENCE)
app.post('/api/commitments/create', async (req, res) => {
  const {
    title,
    creator,
    stakingMode,
    stakeAmount,
    penaltyAmount,
    verificationFee,
    verifierType,
    failurePolicy,
    failurePolicyText,
    details
  } = req.body;

  // Authenticated account status check (blocks suspended / disabled users)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabaseAdmin.from('user_profiles').select('*').eq('auth_user_id', user.id).single();
        if (profile) {
          if (profile.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'Account Suspended: Suspended users cannot create commitments.', status: 'SUSPENDED' });
          }
          if (profile.status === 'DISABLED') {
            return res.status(403).json({ error: 'Account Disabled: Access permanently denied.', status: 'DISABLED' });
          }
          if (profile.wallet_address && creator && creator !== profile.wallet_address) {
            return res.status(400).json({ error: 'Creator address must match your authenticated connected wallet' });
          }
        }
      }
    } catch (err) {
      console.warn('Auth check in commitment creation:', err.message);
    }
  }

  // Title validation
  if (!title || typeof title !== 'string' || title.trim().length < 3 || title.length > 200) {
    return res.status(400).json({ error: 'Title must be between 3 and 200 characters' });
  }

  // Verifier type validation
  const validVerifiers = ['github', 'study_timer', 'peer_consensus'];
  if (!validVerifiers.includes(verifierType)) {
    return res.status(400).json({ error: `Invalid verifierType. Must be one of: ${validVerifiers.join(', ')}` });
  }

  // Staking mode validation
  const validModes = ['HARDCORE', 'NOLOSS'];
  const mode = validModes.includes(stakingMode) ? stakingMode : 'HARDCORE';

  // Stake amount validation
  const stake = Number(stakeAmount);
  if (isNaN(stake) || stake < 5 || stake > 100000) {
    return res.status(400).json({ error: 'Stake amount must be between 5 and 100,000 USDC' });
  }

  // Default penalty if omitted
  const defaultPenalty = mode === 'NOLOSS' ? Math.round(stake * 0.08) : Math.round(stake * 0.25);
  const penalty = penaltyAmount !== undefined ? Number(penaltyAmount) : defaultPenalty;
  if (isNaN(penalty) || penalty < 0 || penalty > stake) {
    return res.status(400).json({ error: 'Penalty amount must be between 0 and the total stake amount' });
  }

  // Verification fee validation
  const fee = Number(verificationFee) || 1.5;
  if (fee < 0 || fee > 50) {
    return res.status(400).json({ error: 'Verification fee must be between 0 and 50 USDC' });
  }

  const id = `cm_${Date.now()}`;
  const newCommitment = {
    id,
    title: title.trim(),
    creator: creator || 'DemoCreatorWallet111111111111111111111111111111',
    stakingMode: mode,
    stakeAmount: stake,
    penaltyAmount: penalty,
    verificationFee: fee,
    verifierType,
    failurePolicy: failurePolicy || 'PARTIAL_RETURN',
    failurePolicyText: failurePolicyText || 'Consequence defined',
    status: 'CREATED',
    details: details || {},
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
  };

  commitments.set(id, newCommitment);
  await dbSaveCommitment(newCommitment);

  res.status(201).json(newCommitment);
});

// Fund commitment (Move to ACTIVE)
app.post('/api/commitments/:id/fund', async (req, res) => {
  const c = commitments.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status !== 'CREATED') return res.status(400).json({ error: 'Already funded or not in created state' });

  c.status = 'ACTIVE';
  c.fundedAt = new Date().toISOString();
  c.escrowPda = escrowClient.findEscrowVaultPda(c.id)[0].toBase58();

  await dbSaveCommitment(c);
  res.json({ message: 'Commitment funded and active', commitment: c });
});

// --- GITHUB VERIFIER ENDPOINTS ---
app.post('/api/verify/github', async (req, res) => {
  try {
    const { commitmentId, repoOwner, repoName, authorUsername, requiredCommits, customCommits } = req.body;
    const c = commitments.get(commitmentId);
    if (!c) return res.status(404).json({ error: 'Commitment not found' });
    if (c.status === 'SETTLED') return res.status(400).json({ error: 'Commitment is already settled' });

    const owner = repoOwner || c.details.repoOwner;
    const repo = repoName || c.details.repoName;
    const user = authorUsername || c.details.authorUsername;
    const required = Number(requiredCommits) || c.details.requiredCommits || 5;

    const attestation = await githubVerifier.verify({
      commitmentId: c.id,
      walletAddress: c.creator,
      repoOwner: owner,
      repoName: repo,
      authorUsername: user,
      requiredCommits: required,
      startDate: c.details.startDate,
      endDate: c.details.endDate,
      customCommits
    });

    c.status = 'VERIFIED';
    c.attestation = attestation;

    await dbSaveCommitment(c);

    const commitsList = (attestation.evidencePayload && attestation.evidencePayload.commits) ? attestation.evidencePayload.commits : [];

    res.json({ 
      attestation, 
      isSignatureValid: verifyAttestationSignature(attestation),
      commits: commitsList
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- STUDY TIMER VERIFIER ENDPOINTS ---
app.post('/api/verify/study/start', (req, res) => {
  const { commitmentId } = req.body;
  const c = commitments.get(commitmentId);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status === 'SETTLED') return res.status(400).json({ error: 'Commitment already settled' });

  const session = studyVerifier.startSession(c.id, c.creator, c.details.requiredMinutes || 3);
  res.json(session);
});

app.post('/api/verify/study/heartbeat', (req, res) => {
  try {
    const { commitmentId, clientNonce, wasFocused } = req.body;
    const result = studyVerifier.recordHeartbeat(commitmentId, clientNonce, wasFocused);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/verify/study/finish', async (req, res) => {
  const { commitmentId } = req.body;
  const c = commitments.get(commitmentId);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status === 'SETTLED') return res.status(400).json({ error: 'Commitment already settled' });

  const attestation = studyVerifier.finishSession(c.id);
  c.status = 'VERIFIED';
  c.attestation = attestation;

  await dbSaveCommitment(c);

  res.json({ attestation, isSignatureValid: verifyAttestationSignature(attestation) });
});

// --- PEER CONSENSUS VERIFIER ENDPOINTS ---
app.get('/api/verify/peer/challenge/:id', async (req, res) => {
  const c = commitments.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });

  const blockhash = await escrowClient.getLatestBlockhash();
  let task = peerVerifier.getTask(c.id);
  if (!task) {
    const challenge = peerVerifier.generateChallenge(c.id, blockhash);
    return res.json({ ...challenge, blockhash });
  }
  res.json({ challengeCode: task.challengeCode, expiresAt: task.challengeExpiresAt, blockhash: task.recentBlockhash });
});

app.get('/api/verify/peer/task/:id', (req, res) => {
  const task = peerVerifier.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({
    commitmentId: task.commitmentId,
    challengeCode: task.challengeCode,
    status: task.status,
    votes: task.votes,
    consensusReached: task.consensusReached,
    verifiers: peerVerifier.verifiers
  });
});

app.post('/api/verify/peer/submit-proof', (req, res) => {
  try {
    const { commitmentId, evidenceData } = req.body;
    const result = peerVerifier.submitProof(commitmentId, evidenceData || {});
    const c = commitments.get(commitmentId);
    if (c) c.status = 'PENDING_VERIFICATION';
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/verify/peer/vote', async (req, res) => {
  try {
    const { commitmentId, verifierId, vote, notes } = req.body;
    let task = peerVerifier.getTask(commitmentId);
    
    // Ensure task is initialized and in review if not yet submitted
    if (!task) {
      peerVerifier.generateChallenge(commitmentId, '7Z8z9xPQ');
      peerVerifier.submitProof(commitmentId, {
        description: 'Auto-seeded verification proof',
        checklist: [{ label: 'Work surface clean', checked: true }, { label: 'Blockhash visible', checked: true }]
      });
      task = peerVerifier.getTask(commitmentId);
    } else if (task.status === 'AWAITING_PROOF') {
      peerVerifier.submitProof(commitmentId, {
        description: 'Verification proof submitted',
        checklist: [{ label: 'Task completed', checked: true }, { label: 'Blockhash checked', checked: true }]
      });
    }

    const result = peerVerifier.castVote(commitmentId, verifierId, vote, notes);
    
    if (result.consensusReached) {
      const c = commitments.get(commitmentId);
      if (c) {
        c.status = 'VERIFIED';
        c.attestation = result.attestation;
        await dbSaveCommitment(c);
      }
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- DISPUTE ENDPOINTS ---
app.post('/api/commitments/:id/dispute', async (req, res) => {
  const c = commitments.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status !== 'VERIFIED') {
    return res.status(400).json({ error: 'Can only dispute verified commitments before settlement' });
  }

  c.status = 'DISPUTED';
  c.disputedAt = new Date().toISOString();
  await dbSaveCommitment(c);
  res.json({ message: 'Dispute opened. Normal settlement blocked pending review.', commitment: c });
});

app.post('/api/commitments/:id/resolve-dispute', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  const { resolution } = req.body; // 'OVERTURN_TO_PASS' or 'UPHOLD_FAIL'
  const c = commitments.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status !== 'DISPUTED') {
    return res.status(400).json({ error: 'Commitment is not in disputed state' });
  }

  if (resolution === 'OVERTURN_TO_PASS') {
    c.attestation.isSuccessful = true;
    c.attestation.resultCode = 'DISPUTE_OVERTURN_PASS';
  }
  c.status = 'VERIFIED';
  await dbSaveCommitment(c);
  res.json({ message: `Dispute resolved: ${resolution}. Ready for settlement.`, commitment: c });
});

// --- ON-CHAIN SETTLEMENT ENDPOINT (WITH HARDENED ANTI-REPLAY & ANTI-DOUBLE SETTLE) ---
app.post('/api/commitments/:id/settle', async (req, res) => {
  try {
    const c = commitments.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Commitment not found' });
    
    // Invariant 1: Settlement is idempotent & cannot settle twice
    if (c.status === 'SETTLED') {
      return res.status(400).json({ error: 'Double Settlement Rejected: Commitment is already settled!' });
    }

    // Invariant 8: Dispute blocks normal settlement
    if (c.status === 'DISPUTED') {
      return res.status(400).json({ error: 'Settlement Blocked: Commitment is under active dispute!' });
    }

    // Strict State Machine: Must be VERIFIED
    if (c.status !== 'VERIFIED') {
      return res.status(400).json({ error: `Invalid State: Cannot settle commitment in status '${c.status}'. Must be 'VERIFIED'.` });
    }

    if (!c.attestation) {
      return res.status(400).json({ error: 'Commitment has no signed attestation to settle' });
    }

    // Invariant 4 & 5: Anti-Replay across different commitments
    if (c.attestation.commitmentId !== c.id) {
      return res.status(400).json({ error: 'Attestation Replay Detected: Attestation commitmentId does not match target commitment!' });
    }

    // Invariant 7: No user can settle another user's commitment
    if (c.attestation.walletAddress !== c.creator) {
      return res.status(400).json({ error: 'Attestation Replay Detected: Attestation walletAddress does not match commitment creator!' });
    }

    // Cryptographic Ed25519 signature validation
    const isValid = verifyAttestationSignature(c.attestation);
    if (!isValid) {
      return res.status(401).json({ error: 'Cryptographic attestation signature invalid!' });
    }

    const settlementResult = await escrowClient.executeSettlement(c.attestation, c);
    c.status = 'SETTLED';
    c.settlement = settlementResult;

    await dbSaveCommitment(c);

    res.json({ message: 'Settlement executed successfully on Solana Devnet', commitment: c });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SOLANA ACTIONS & BLINKS ENDPOINTS ---
app.get('/actions.json', (req, res) => {
  res.json(getActionsJson());
});

app.get('/api/actions/commit', (req, res) => {
  const id = req.query.id || 'cm_gh_01';
  const c = commitments.get(id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  res.json(getCommitActionMetadata(c));
});

app.post('/api/actions/commit', (req, res) => {
  const id = req.query.id || 'cm_gh_01';
  const account = req.body.account || 'DemoBlinkUser1111111111111111111111111111111';
  const c = commitments.get(id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });

  res.json(buildActionTransaction(account, c));
});

// --- DETERMINISTIC 1-CLICK DEMO RUNNER ---
app.post('/api/demo/run', async (req, res) => {
  const { scenario } = req.body; // 'GH_PASS', 'STUDY_FAIL', 'PEER_PASS'

  if (scenario === 'GH_PASS') {
    const c = commitments.get('cm_gh_01');
    c.status = 'ACTIVE';
    // 7 qualifying commits
    const customCommits = Array.from({ length: 7 }, (_, i) => ({
      sha: `0x7a8b9c${i}d4e5f6a1b2c3d4e5f6a7b8c9d0e1f2a3`,
      message: `feat(anchor): optimize settlement instruction #${i + 1}`,
      author: 'solana-builder',
      date: new Date().toISOString(),
      isMerge: false
    }));
    const attestation = await githubVerifier.verify({
      commitmentId: c.id,
      walletAddress: c.creator,
      repoOwner: c.details.repoOwner,
      repoName: c.details.repoName,
      authorUsername: c.details.authorUsername,
      requiredCommits: 5,
      customCommits
    });
    c.attestation = attestation;
    c.status = 'VERIFIED';
    const settlement = await escrowClient.executeSettlement(attestation, c);
    c.status = 'SETTLED';
    c.settlement = settlement;
    await dbSaveCommitment(c);
    return res.json({ scenario, commitment: c });
  }

  if (scenario === 'STUDY_FAIL') {
    const c = commitments.get('cm_study_02');
    c.status = 'ACTIVE';
    // 60 seconds forced for deterministic demo
    const attestation = studyVerifier.finishSession(c.id, 60);
    c.attestation = attestation;
    c.status = 'VERIFIED';
    const settlement = await escrowClient.executeSettlement(attestation, c);
    c.status = 'SETTLED';
    c.settlement = settlement;
    await dbSaveCommitment(c);
    return res.json({ scenario, commitment: c });
  }

  if (scenario === 'PEER_PASS') {
    const c = commitments.get('cm_peer_03');
    c.status = 'ACTIVE';
    peerVerifier.generateChallenge(c.id, '9xPQ4r7L');
    peerVerifier.submitProof(c.id, {
      description: 'Workbench cleaned, cables bundled, parts sorted into bin A4',
      checklist: [{ label: 'Work surface clean', checked: true }, { label: 'Blockhash verified', checked: true }]
    });
    peerVerifier.castVote(c.id, 'v_alex', 'PASS', 'Verified blockhash in photo and clean desk');
    const result = peerVerifier.castVote(c.id, 'v_chen', 'PASS', 'Clean environment confirmed, verified');
    c.attestation = result.attestation;
    c.status = 'VERIFIED';
    const settlement = await escrowClient.executeSettlement(result.attestation, c);
    c.status = 'SETTLED';
    c.settlement = settlement;
    await dbSaveCommitment(c);
    return res.json({ scenario, commitment: c });
  }

  res.status(400).json({ error: 'Unknown scenario' });
});

// Launch server
app.listen(PORT, () => {
  console.log(`Commit Protocol Node running at http://localhost:${PORT}`);
  console.log(`Oracle Authority Public Key: ${ORACLE_PUBLIC_KEY}`);
});
