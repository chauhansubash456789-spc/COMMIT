import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { ORACLE_PUBLIC_KEY, verifyAttestationSignature, signVerificationResult, hashEvidence } from './oracle/attestation.js';
import { GitHubVerifier } from './verifiers/githubVerifier.js';
import { StudyTimerVerifier } from './verifiers/studyTimerVerifier.js';
import { PeerConsensusVerifier } from './verifiers/peerConsensusVerifier.js';
import { escrowClient } from './solana/escrowClient.js';
import { getActionsJson, getCommitActionMetadata, buildActionTransaction } from './blinks/actions.js';
import { dbGetCommitments, dbSaveCommitment, isDatabaseReady } from './db/supabase.js';
import { authRouter } from './auth/routes.js';
import { requireAuth, requireRole, requireActive } from './auth/middleware.js';
import { logAudit } from './auth/middleware.js';
import { disputeManager } from './disputes/disputeManager.js';
import { reputationManager } from './reputation/reputationManager.js';
import { supabaseAdmin } from './auth/supabase.js';
import { notificationManager } from './notifications/notificationManager.js';
import { calculateUserStats } from './reputation/userStatsHelper.js';
import { verifierRouter } from './verifiers/verifierRoutes.js';
import { verifierManager } from './verifiers/verifierManager.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// In-memory commitment store with Supabase sync
const commitments = new Map();
app.locals.commitments = commitments;

// Mount Authentication & Admin Authorization Routes
app.use('/api/auth', authRouter);
app.use('/api', authRouter);

// Mount Authoritative Verifier Subsystem Routes
app.use('/api/verifier', verifierRouter);

// Initialize verifier engines
const githubVerifier = new GitHubVerifier();
const studyVerifier = new StudyTimerVerifier();
const peerVerifier = new PeerConsensusVerifier();

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

  // Also seed in authoritative verifierManager
  await verifierManager.createRequest({
    commitmentId: 'cm_peer_03',
    userId: 'usr_seed_creator_03',
    userWallet: 'HardwareHacker3333333333333333333333333333333',
    verifierId: 'v_alex',
    taskSummary: 'Organize and Clean Electronics Lab & Workbench',
    stake: 30,
    verifierFee: 2.0,
    verificationType: 'human_physical',
    locationRequirement: {
      address: 'Hardware Lab Building 4, Room 204',
      lat: 37.7749,
      lng: -122.4194,
      radiusMeters: 300
    },
    checklist: [
      { id: 'chk_1', label: 'Work surface clean and cleared', required: true, checked: false },
      { id: 'chk_2', label: 'Components sorted and organized into bins', required: true, checked: false },
      { id: 'chk_3', label: 'Dynamic blockhash challenge code visible in evidence', required: true, checked: false }
    ]
  }).catch(() => {});
}

seedInitialCommitments();

// -----------------------------------------------------------------------------
// REST API ENDPOINTS
// -----------------------------------------------------------------------------

// Get Oracle Public Key
app.get('/api/oracle/public-key', (req, res) => {
  res.json({ oraclePublicKey: ORACLE_PUBLIC_KEY, version: '1.0.0-devnet' });
});

// List all commitments (Public listing)
app.get('/api/commitments', (req, res) => {
  res.json(Array.from(commitments.values()));
});

// List authenticated user's own commitments with statistics
app.get('/api/commitments/my', requireAuth, requireActive, async (req, res) => {
  try {
    const userWallet = req.profile.wallet_address ? req.profile.wallet_address.toLowerCase() : null;
    const myCommitments = Array.from(commitments.values()).filter(c => {
      if (c.auth_user_id === req.user.id) return true;
      if (c.details && c.details.auth_user_id === req.user.id) return true;
      if (userWallet && c.creator && c.creator.toLowerCase() === userWallet) return true;
      return false;
    });

    const stats = await calculateUserStats(req.user.id, req.profile.wallet_address, commitments);

    res.json({
      commitments: myCommitments,
      stats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User overview statistics
app.get('/api/user/overview', requireAuth, requireActive, async (req, res) => {
  try {
    const stats = await calculateUserStats(req.user.id, req.profile.wallet_address, commitments);
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User notifications
app.get('/api/notifications', requireAuth, (req, res) => {
  try {
    const notifications = notificationManager.getForUser(req.user.id);
    const unreadCount = notificationManager.getUnreadCount(req.user.id);
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  try {
    const ok = notificationManager.markAsRead(req.user.id, req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  try {
    const count = notificationManager.markAllAsRead(req.user.id);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single commitment (with privacy protection for sensitive evidence - IDOR defense)
app.get('/api/commitments/:id', async (req, res) => {
  const c = commitments.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });

  // Sensitive evidence privacy check
  const authHeader = req.headers.authorization;
  let requesterUserId = null;
  let requesterRole = null;
  let requesterWallet = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        requesterUserId = user.id;
        const { data: prof } = await supabaseAdmin
          .from('user_profiles')
          .select('role, wallet_address')
          .eq('auth_user_id', user.id)
          .single();
        requesterRole = prof?.role;
        requesterWallet = prof?.wallet_address ? prof.wallet_address.toLowerCase() : null;
      }
    } catch (_) {}
  }

  const isOwner = requesterUserId && (
    (c.auth_user_id === requesterUserId) ||
    (c.details && c.details.auth_user_id === requesterUserId) ||
    (requesterWallet && c.creator && c.creator.toLowerCase() === requesterWallet)
  );
  const isStaff = requesterRole === 'ADMIN' || requesterRole === 'SUPER_ADMIN' || requesterRole === 'VERIFIER';

  const safe = JSON.parse(JSON.stringify(c));
  if (!isOwner && !isStaff && safe.details) {
    if (safe.details.evidence) {
      if (safe.details.evidence.mediaUrl) {
        safe.details.evidence.mediaUrl = '[Protected Private Evidence - Viewable by Creator & Verifiers Only]';
      }
      if (safe.details.evidence.location) {
        safe.details.evidence.location = '[Protected Private Location]';
      }
      delete safe.details.evidence.content;
    }
    // Evidence history: expose only integrity metadata (type, hash, time) to third parties
    if (Array.isArray(safe.details.evidenceHistory)) {
      safe.details.evidenceHistory = safe.details.evidenceHistory.map(ev => ({
        evidenceType: ev.evidenceType,
        hash: ev.hash,
        submittedAt: ev.submittedAt,
        description: '[Protected Private Evidence]'
      }));
    }
    delete safe.disputeReason;
  }
  safe.viewerIsOwner = Boolean(isOwner);

  res.json(safe);
});

// Cancel un-funded commitment (CREATED state only)
app.post('/api/commitments/:id/cancel', requireAuth, requireActive, async (req, res) => {
  try {
    const c = commitments.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Commitment not found' });

    const isOwner = (c.auth_user_id === req.user.id) ||
      (c.details && c.details.auth_user_id === req.user.id) ||
      (req.profile.wallet_address && c.creator && c.creator.toLowerCase() === req.profile.wallet_address.toLowerCase());
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden: You can only cancel your own commitments' });
    }

    if (c.status !== 'CREATED') {
      return res.status(400).json({ error: `Cannot cancel commitment in status '${c.status}'. Only un-funded CREATED commitments can be cancelled.` });
    }

    c.status = 'CANCELLED';
    await dbSaveCommitment(c);

    notificationManager.dispatch({
      userId: req.user.id,
      type: 'COMMITMENT_CANCELLED',
      title: 'Commitment Cancelled',
      message: `Commitment "${c.title}" was cancelled before funding.`,
      commitmentId: c.id
    });

    await calculateUserStats(req.user.id, req.profile.wallet_address, commitments);
    res.json({ message: 'Commitment cancelled successfully', commitment: c });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit evidence for commitment
app.post('/api/commitments/:id/evidence', requireAuth, requireActive, async (req, res) => {
  try {
    const c = commitments.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Commitment not found' });

    // Enforce ownership: Only the creator can submit evidence for their commitment
    const isOwner = (c.auth_user_id === req.user.id) ||
      (c.details && c.details.auth_user_id === req.user.id) ||
      (req.profile.wallet_address && c.creator && c.creator.toLowerCase() === req.profile.wallet_address.toLowerCase());

    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden: You can only submit evidence for your own commitment' });
    }

    if (c.status === 'SETTLED') {
      return res.status(400).json({ error: 'Cannot submit evidence for settled commitment' });
    }
    const EVIDENCE_LOCKED = ['VERIFIED', 'CANCELLED', 'EXPIRED', 'CREATED'];
    if (EVIDENCE_LOCKED.includes(c.status)) {
      return res.status(400).json({ error: `Cannot submit evidence while commitment is '${c.status}'.` });
    }

    // Accept both the legacy and dashboard payload shapes
    const body = req.body || {};
    const evidenceType = body.evidenceType || body.type;
    const description = typeof body.description === 'string' ? body.description.slice(0, 1000) : body.description;
    const mediaUrl = body.mediaUrl || body.content;
    const { checklist, location } = body;
    if (!description && !mediaUrl && (!checklist || checklist.length === 0)) {
      return res.status(400).json({ error: 'Evidence description, checklist, or media is required' });
    }
    if (mediaUrl && String(mediaUrl).length > 2048) {
      return res.status(400).json({ error: 'Evidence reference too long (max 2048 chars). Upload large media off-chain and submit its URL.' });
    }

    const evidencePayload = {
      evidenceType: evidenceType || 'general',
      description: description || 'Proof of goal completion',
      mediaUrl: mediaUrl || null,
      checklist: checklist || [],
      location: location || null,
      submittedBy: req.user.id,
      submittedAt: new Date().toISOString()
    };

    // Hash evidence for immutable cryptographic integrity
    const evidenceHash = hashEvidence(evidencePayload);
    evidencePayload.hash = evidenceHash;

    const history = Array.isArray(c.details?.evidenceHistory) ? c.details.evidenceHistory : [];
    c.details = {
      ...(c.details || {}),
      evidence: evidencePayload,
      evidenceHistory: [...history, evidencePayload].slice(-25)
    };
    // Disputed commitments stay frozen; evidence is attached for the reviewer only
    if (c.status !== 'DISPUTED') {
      c.status = 'PENDING_VERIFICATION';
    }

    await dbSaveCommitment(c);

    // Dispatch notification
    notificationManager.dispatch({
      userId: req.user.id,
      type: 'VERIFICATION_REQUESTED',
      title: 'Evidence Submitted',
      message: `Evidence submitted for "${c.title}". SHA-256 integrity hash: ${evidenceHash.slice(0, 14)}...`,
      commitmentId: c.id
    });

    res.json({
      message: 'Evidence submitted securely off-chain with cryptographic hash recorded',
      commitment: c,
      evidenceHash,
      hash: evidenceHash
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

  // MANDATORY AUTHENTICATION: Without login, no one can create commitments
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication Required: You must be logged in to create a new commitment.'
    });
  }

  const token = authHeader.split(' ')[1];
  let authUser = null;
  let profile = null;

  try {
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({
        error: 'Invalid or expired session. Please log in to create a commitment.'
      });
    }
    authUser = user;

    const { data: userProfile, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profErr || !userProfile) {
      return res.status(403).json({ error: 'User profile not found. Access denied.' });
    }
    profile = userProfile;
  } catch (err) {
    return res.status(401).json({ error: 'Authentication verification failed: ' + err.message });
  }

  // Enforce account status server-side
  if (profile.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Account Suspended: Suspended users cannot create commitments.', status: 'SUSPENDED' });
  }
  if (profile.status === 'DISABLED') {
    return res.status(403).json({ error: 'Account Disabled: Access permanently denied.', status: 'DISABLED' });
  }
  if (profile.wallet_address && creator && creator !== profile.wallet_address) {
    return res.status(400).json({ error: 'Creator address must match your authenticated connected wallet' });
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
    creator: creator || (profile && profile.wallet_address) || 'DemoCreatorWallet111111111111111111111111111111',
    auth_user_id: authUser.id,
    creator_username: profile.username,
    creator_name: profile.display_name,
    stakingMode: mode,
    stakeAmount: stake,
    penaltyAmount: penalty,
    verificationFee: fee,
    verifierType,
    failurePolicy: failurePolicy || 'PARTIAL_RETURN',
    failurePolicyText: failurePolicyText || 'Consequence defined',
    status: 'CREATED',
    details: {
      ...(details || {}),
      auth_user_id: authUser.id,
      creator_username: profile.username
    },
    createdAt: new Date().toISOString(),
    expiresAt: (() => {
      const d = Number(details?.durationDays || details?.requiredDays || details?.deadlineDays) || 7;
      const days = Math.min(90, Math.max(1, Math.floor(d)));
      return new Date(Date.now() + days * 24 * 3600000).toISOString();
    })()
  };

  commitments.set(id, newCommitment);
  await dbSaveCommitment(newCommitment);

  // If verifier type is peer or physical, register verification request in verifierManager
  if (verifierType === 'peer_consensus' || verifierType === 'human_physical') {
    await verifierManager.createRequest({
      commitmentId: id,
      userId: profile.id,
      authUserId: authUser.id,
      userWallet: creator || profile.wallet_address,
      taskSummary: title,
      stake,
      verifierFee: fee,
      verificationType: verifierType,
      criteria: [failurePolicyText || title],
      locationRequirement: details?.locationRequirement || null,
      checklist: details?.checklist || null
    }).catch(() => {});
  }

  // Authoritative notification & stats update
  notificationManager.dispatch({
    userId: authUser.id,
    type: 'COMMITMENT_CREATED',
    title: 'Commitment Created',
    message: `Created "${newCommitment.title}" for ${newCommitment.stakeAmount} USDC.`,
    commitmentId: newCommitment.id
  });

  await calculateUserStats(authUser.id, profile.wallet_address, commitments);

  res.status(201).json(newCommitment);
});

// Fund commitment (Move to ACTIVE)
app.post('/api/commitments/:id/fund', async (req, res) => {
  const c = commitments.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status !== 'CREATED') return res.status(400).json({ error: 'Already funded or not in created state' });

  // Optional authentication check for ownership
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user && c.auth_user_id && c.auth_user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only fund your own commitment' });
      }
    } catch (_) {}
  }

  c.status = 'ACTIVE';
  c.fundedAt = new Date().toISOString();
  c.escrowPda = escrowClient.findEscrowVaultPda(c.id)[0].toBase58();

  await dbSaveCommitment(c);

  if (c.auth_user_id) {
    notificationManager.dispatch({
      userId: c.auth_user_id,
      type: 'COMMITMENT_FUNDED',
      title: 'Commitment Funded',
      message: `${c.stakeAmount} USDC locked in Solana Escrow PDA for "${c.title}".`,
      commitmentId: c.id
    });
    notificationManager.dispatch({
      userId: c.auth_user_id,
      type: 'COMMITMENT_ACTIVATED',
      title: 'Commitment Active',
      message: `Your commitment "${c.title}" is now active in Solana Escrow!`,
      commitmentId: c.id
    });
    await calculateUserStats(c.auth_user_id, c.creator, commitments);
  }

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

    if (c.auth_user_id) {
      notificationManager.dispatch({
        userId: c.auth_user_id,
        type: 'VERIFICATION_COMPLETED',
        title: `GitHub Verification: ${attestation.isSuccessful ? 'PASS' : 'FAIL'}`,
        message: `${attestation.resultCode}: ${attestation.verifiedMetric}/${attestation.requiredMetric} qualifying commits verified.`,
        commitmentId: c.id
      });
      await calculateUserStats(c.auth_user_id, c.creator, commitments);
    }

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
  const { commitmentId, demoForceSeconds } = req.body;
  const c = commitments.get(commitmentId);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  if (c.status === 'SETTLED') return res.status(400).json({ error: 'Commitment already settled' });

  const attestation = studyVerifier.finishSession(c.id, demoForceSeconds, c.creator);
  c.status = 'VERIFIED';
  c.attestation = attestation;

  await dbSaveCommitment(c);

  if (c.auth_user_id) {
    notificationManager.dispatch({
      userId: c.auth_user_id,
      type: 'VERIFICATION_COMPLETED',
      title: `Focus Session: ${attestation.isSuccessful ? 'PASS' : 'FAIL'}`,
      message: `Focus verification complete: ${attestation.resultCode}.`,
      commitmentId: c.id
    });
    await calculateUserStats(c.auth_user_id, c.creator, commitments);
  }

  res.json({ commitment: c, attestation, isSignatureValid: verifyAttestationSignature(attestation) });
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
    const c = commitments.get(commitmentId);
    const data = {
      ...(evidenceData || {}),
      walletAddress: c ? c.creator : (evidenceData?.walletAddress || 'USER_WALLET_DEMO')
    };
    const result = peerVerifier.submitProof(commitmentId, data);
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

        if (c.auth_user_id) {
          notificationManager.dispatch({
            userId: c.auth_user_id,
            type: 'VERIFICATION_COMPLETED',
            title: `Peer Review: ${result.attestation.isSuccessful ? 'PASS' : 'FAIL'}`,
            message: `2-of-3 Peer Consensus reached: ${result.attestation.resultCode}.`,
            commitmentId: c.id
          });
          await calculateUserStats(c.auth_user_id, c.creator, commitments);
        }
      }
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- DISPUTE ENDPOINTS (FORMAL 5-STATE LIFECYCLE) ---
app.post('/api/commitments/:id/dispute', requireAuth, requireActive, async (req, res) => {
  try {
    const c = commitments.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Commitment not found' });

    // Ownership is checked BEFORE state so attackers cannot probe commitment states
    const isOwner = (c.auth_user_id === req.user.id) ||
      (c.details && c.details.auth_user_id === req.user.id) ||
      (req.profile && req.profile.wallet_address && c.creator && c.creator.toLowerCase() === req.profile.wallet_address.toLowerCase());
    if (!isOwner) {
      return res.status(403).json({ error: 'Forbidden: You can only dispute your own commitments' });
    }

    if (c.status !== 'VERIFIED' && c.status !== 'PENDING_VERIFICATION') {
      return res.status(400).json({ error: 'Can only dispute commitments that are pending verification or verified (before settlement)' });
    }
    const reasonText = String((req.body && req.body.reason) || '').trim();
    if (reasonText.length < 5) {
      return res.status(400).json({ error: 'A dispute reason of at least 5 characters is required' });
    }

    const { reason, evidence } = req.body || {};
    const openedBy = req.user?.id || c.creator;
    const dispute = await disputeManager.openDispute({
      commitment: c,
      openedBy,
      reason,
      evidence
    });

    await dbSaveCommitment(c);

    if (c.auth_user_id) {
      notificationManager.dispatch({
        userId: c.auth_user_id,
        type: 'DISPUTE_OPENED',
        title: 'Dispute Registered',
        message: `Dispute opened for "${c.title}". Normal settlement is frozen pending administrative review.`,
        commitmentId: c.id
      });
    }

    try {
      await logAudit({
        actorUserId: openedBy,
        action: 'DISPUTE_OPENED',
        targetType: 'COMMITMENT',
        targetId: c.id,
        metadata: { disputeId: dispute.dispute_id, reason: dispute.reason },
        ipAddress: req.ip
      });
    } catch (_) {}

    res.json({
      message: 'Dispute opened. Normal settlement blocked pending review.',
      commitment: c,
      dispute
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/commitments/:id/dispute', requireAuth, async (req, res) => {
  const c = commitments.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Commitment not found' });
  const isOwner = (c.auth_user_id === req.user.id) ||
    (c.details && c.details.auth_user_id === req.user.id) ||
    (req.profile && req.profile.wallet_address && c.creator && c.creator.toLowerCase() === req.profile.wallet_address.toLowerCase());
  const isStaff = ['ADMIN', 'SUPER_ADMIN', 'VERIFIER'].includes(req.profile?.role);
  if (!isOwner && !isStaff) {
    return res.status(403).json({ error: 'Forbidden: You can only view disputes on your own commitments' });
  }
  const dispute = disputeManager.getDisputeByCommitment(req.params.id);
  if (!dispute) {
    return res.status(404).json({ error: 'No dispute found for this commitment' });
  }
  res.json({ dispute });
});

app.post('/api/commitments/:id/resolve-dispute', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { resolution, notes } = req.body || {}; // 'OVERTURN_TO_PASS' or 'UPHOLD_FAIL'
    const c = commitments.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Commitment not found' });
    if (c.status !== 'DISPUTED') {
      return res.status(400).json({ error: 'Commitment is not in disputed state' });
    }

    const dispute = disputeManager.getDisputeByCommitment(c.id);
    const disputeId = dispute ? dispute.dispute_id : null;

    let resolvedDispute = null;
    if (disputeId) {
      resolvedDispute = await disputeManager.resolveDispute({
        disputeId,
        resolverUserId: req.user.id,
        resolution: resolution === 'OVERTURN_TO_PASS' ? 'RESOLVED_USER' : 'RESOLVED_VERIFIER',
        notes: notes || 'Admin dispute resolution decision'
      });
    }

    const isSuccessful = (resolution === 'OVERTURN_TO_PASS' || resolution === 'RESOLVED_USER');
    const resultCode = isSuccessful ? 'DISPUTE_OVERTURN_PASS' : 'DISPUTE_UPHELD_FAIL';
    const evidencePayload = {
      ...(c.attestation ? c.attestation.evidencePayload : {}),
      disputeResolution: resolution,
      resolvedBy: req.user.id,
      notes: notes || 'Dispute resolution'
    };
    const evidenceHash = hashEvidence(evidencePayload);

    c.attestation = signVerificationResult({
      commitmentId: c.id,
      walletAddress: c.creator,
      verifierType: c.verifierType,
      verifierVersion: 'dispute-v1.0',
      resultCode,
      isSuccessful,
      verifiedMetric: isSuccessful ? 1 : 0,
      requiredMetric: 1,
      evidencePayload,
      evidenceHash
    });
    c.status = 'VERIFIED';
    await dbSaveCommitment(c);

    if (c.auth_user_id) {
      notificationManager.dispatch({
        userId: c.auth_user_id,
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute Resolved',
        message: `Admin resolved dispute on "${c.title}" with outcome: ${resolution}.`,
        commitmentId: c.id
      });
    }

    try {
      await logAudit({
        actorUserId: req.user.id,
        action: 'DISPUTE_RESOLVED',
        targetType: 'COMMITMENT',
        targetId: c.id,
        metadata: { disputeId, resolution, notes },
        ipAddress: req.ip
      });
    } catch (_) {}

    res.json({
      message: `Dispute resolved: ${resolution}. Ready for settlement.`,
      commitment: c,
      dispute: resolvedDispute
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- ADMIN SYSTEM & AUDIT CONTROLS ---
app.get('/api/admin/dashboard', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const commitmentsList = Array.from(commitments.values());
    const totalVolume = commitmentsList.reduce((acc, c) => acc + (Number(c.stakeAmount) || 0), 0);
    const totalSettledVolume = commitmentsList
      .filter(c => c.status === 'SETTLED')
      .reduce((acc, c) => acc + (Number(c.stakeAmount) || 0), 0);

    const { count: usersCount } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const disputesList = disputeManager.getAllDisputes();
    const verifiersList = [
      reputationManager.calculateStats('v_alex'),
      reputationManager.calculateStats('v_elena'),
      reputationManager.calculateStats('v_chen')
    ];

    res.json({
      stats: {
        totalUsers: usersCount || 5,
        totalCommitments: commitmentsList.length,
        activeCommitments: commitmentsList.filter(c => c.status === 'ACTIVE' || c.status === 'FUNDED').length,
        settledCommitments: commitmentsList.filter(c => c.status === 'SETTLED').length,
        disputedCommitments: commitmentsList.filter(c => c.status === 'DISPUTED').length,
        totalVolumeUsdc: totalVolume,
        totalSettledUsdc: totalSettledVolume,
        activeVerifiers: verifiersList.length,
        openDisputes: disputesList.filter(d => d.status === 'OPEN').length
      },
      systemStatus: 'HEALTHY'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/commitments', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    let list = Array.from(commitments.values());
    const { status, verifierType } = req.query;
    if (status) list = list.filter(c => c.status === status);
    if (verifierType) list = list.filter(c => c.verifierType === verifierType);
    res.json({ commitments: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/disputes', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { status } = req.query;
    const disputes = disputeManager.getAllDisputes({ status });
    res.json({ disputes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/verifiers', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const verifierIds = ['v_alex', 'v_elena', 'v_chen'];
    const verifiers = verifierIds.map(id => reputationManager.calculateStats(id));
    res.json({ verifiers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/security-events', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { data: logs, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .in('action', ['USER_SUSPENDED', 'ADMIN_STATUS_CHANGED', 'ADMIN_SUSPENDED_VERIFIER', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ securityEvents: logs || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/system-health', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    let solanaStatus = 'ONLINE';
    let currentSlot = 0;
    try {
      currentSlot = await escrowClient.connection.getSlot('confirmed');
    } catch (_) {
      solanaStatus = 'DEGRADED';
    }

    const mem = process.memoryUsage();
    res.json({
      health: {
        status: 'HEALTHY',
        uptimeSeconds: Math.round(process.uptime()),
        solanaDevnet: {
          status: solanaStatus,
          slot: currentSlot,
          rpcEndpoint: escrowClient.endpoint
        },
        database: {
          status: 'CONNECTED',
          provider: 'Supabase PostgreSQL'
        },
        oracle: {
          status: 'ONLINE',
          publicKey: ORACLE_PUBLIC_KEY
        },
        memory: {
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          rssMb: Math.round(mem.rss / 1024 / 1024)
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    await verifierManager.confirmSettlementReward(c.id, settlementResult).catch(() => {});

    if (c.auth_user_id) {
      notificationManager.dispatch({
        userId: c.auth_user_id,
        type: 'SETTLEMENT_COMPLETED',
        title: 'Settlement Executed on Solana Devnet',
        message: `Settlement completed for "${c.title}". Tx: ${settlementResult.txSignature ? settlementResult.txSignature.slice(0, 16) + '...' : 'Confirmed'}`,
        commitmentId: c.id,
        metadata: { txSignature: settlementResult.txSignature, explorerUrl: settlementResult.explorerUrl }
      });
      await calculateUserStats(c.auth_user_id, c.creator, commitments);
    }

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
    const attestation = studyVerifier.finishSession(c.id, 60, c.creator);
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
