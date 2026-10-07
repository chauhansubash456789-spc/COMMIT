import express from 'express';
import { requireAuth, requireActive, requireRole } from '../auth/middleware.js';
import { verifierManager } from './verifierManager.js';
import { reputationManager } from '../reputation/reputationManager.js';
import { dbSaveCommitment } from '../db/supabase.js';

export const verifierRouter = express.Router();

/**
 * Middleware: Requires that user has active verifier privileges (VERIFIER, ADMIN, SUPER_ADMIN)
 */
async function requireVerifierAccess(req, res, next) {
  if (!req.profile) {
    return res.status(401).json({ error: 'Unauthorized: Profile not loaded' });
  }

  // Admins always have access
  if (['ADMIN', 'SUPER_ADMIN'].includes(req.profile.role)) {
    return next();
  }

  // Check verifier profile
  const verifier = await verifierManager.getVerifierProfile(req.user.id);
  if (!verifier) {
    return res.status(403).json({
      error: 'Forbidden: Verifier access required. Please apply as a verifier first.',
      needsApplication: true
    });
  }

  if (verifier.status === 'SUSPENDED') {
    return res.status(403).json({
      error: 'Forbidden: Your verifier account is currently suspended.',
      verifierStatus: 'SUSPENDED'
    });
  }

  if (verifier.status === 'PENDING') {
    return res.status(403).json({
      error: 'Forbidden: Your verifier application is pending administrative review.',
      verifierStatus: 'PENDING'
    });
  }

  req.verifier = verifier;
  next();
}

/**
 * GET /api/verifier/dashboard
 * Authoritative dashboard metrics & task queues for authenticated verifier
 */
verifierRouter.get('/dashboard', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const data = await verifierManager.getDashboardData(req.user.id);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/verifier/profile
 * Retrieves verifier profile & public authoritative statistics
 */
verifierRouter.get('/profile', async (req, res) => {
  try {
    const verifierId = req.query.id || req.query.userId;
    if (!verifierId) {
      return res.status(400).json({ error: 'Missing verifier identifier parameter' });
    }

    const profile = await verifierManager.getVerifierProfile(verifierId);
    if (!profile) {
      return res.status(404).json({ error: 'Verifier profile not found' });
    }

    // Dynamic stats derived mathematically from events
    const stats = reputationManager.calculateStats(profile.id);
    const earnings = await verifierManager.getVerifierEarnings(profile.id);

    res.json({
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        bio: profile.bio,
        specializations: profile.specializations,
        serviceArea: profile.serviceArea,
        verificationStatus: profile.status,
        availability: profile.availability,
        wallet: profile.wallet,
        profileImage: profile.profileImage,
        createdAt: profile.createdAt
      },
      stats: {
        completed: stats.completed,
        accuracy: stats.accuracy,
        disputes: stats.disputes,
        successfulResolutions: stats.successfulResolutions,
        rating: stats.rating,
        totalEarnedUSDC: earnings.totalEarned
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/verifier/availability
 * Updates verifier availability (Available, Busy, Unavailable)
 */
verifierRouter.put('/availability', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const { availability } = req.body;
    const updated = await verifierManager.updateAvailability(req.user.id, availability);
    res.json({ message: 'Availability updated successfully', availability: updated.availability });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/verifier/requests
 * Retrieves authorized verification requests for the current verifier.
 * Anti-IDOR: Verifier A cannot see Verifier B's private requests.
 */
verifierRouter.get('/requests', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const { status } = req.query;
    const requests = await verifierManager.getRequestsForVerifier(req.user.id, { status });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/verifier/requests/:id
 * Authoritatively views a single verification request with permission check
 */
verifierRouter.get('/requests/:id', requireAuth, requireActive, async (req, res) => {
  try {
    const request = await verifierManager.getRequestById(req.params.id, req.user.id, req.profile.role);
    if (!request) {
      return res.status(404).json({ error: 'Verification request not found or access denied (Anti-IDOR)' });
    }
    res.json({ request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/verifier/requests/:id/accept
 * Verifier accepts a pending request.
 * Strictly enforces Anti-Self-Verification (Conflict of interest).
 */
verifierRouter.post('/requests/:id/accept', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const request = await verifierManager.acceptRequest(req.params.id, req.user.id);
    res.json({ message: 'Verification request accepted successfully', request });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/verifier/requests/:id/decline
 * Verifier declines a request with an honest reason.
 */
verifierRouter.post('/requests/:id/decline', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await verifierManager.declineRequest(req.params.id, req.user.id, reason);
    res.json({ message: 'Verification request declined', request });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/verifier/checkin/qr
 * Generates an ephemeral 5-minute QR check-in token
 */
verifierRouter.post('/checkin/qr', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId is required' });

    const qrData = await verifierManager.generateCheckinQR(requestId, req.user.id);
    res.json(qrData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/verifier/checkin/verify
 * Validates QR check-in token, server timestamp, and location signal
 */
verifierRouter.post('/checkin/verify', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const { requestId, qrToken, verifierLocation } = req.body;
    if (!requestId || !qrToken) {
      return res.status(400).json({ error: 'requestId and qrToken are required' });
    }

    const result = await verifierManager.verifyCheckin(requestId, req.user.id, {
      qrToken,
      verifierLocation
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/verifier/requests/:id/submit
 * Submits authoritative evaluation of locked checklist & generates signed attestation
 */
verifierRouter.post('/requests/:id/submit', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const { outcome, checklistEvaluations, notes } = req.body;
    if (!outcome || !['PASS', 'FAIL'].includes(outcome)) {
      return res.status(400).json({ error: "Outcome must be 'PASS' or 'FAIL'" });
    }

    const result = await verifierManager.submitVerificationDecision(req.params.id, req.user.id, {
      outcome,
      checklistEvaluations: checklistEvaluations || [],
      notes: notes || ''
    });

    // Sync target commitment object if in commitments map (passed via app.locals or shared scope)
    const commitmentsMap = req.app.locals.commitments;
    if (commitmentsMap) {
      const request = await verifierManager.getRequestById(req.params.id, req.user.id, 'ADMIN');
      if (request && commitmentsMap.has(request.commitment_id)) {
        const c = commitmentsMap.get(request.commitment_id);
        c.status = 'VERIFIED';
        c.attestation = result.attestation;
        await dbSaveCommitment(c);
      }
    }

    res.json({
      message: `Verification decision submitted: ${result.resultCode}`,
      result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/verifier/earnings
 * Returns authoritative earnings records and totals
 */
verifierRouter.get('/earnings', requireAuth, requireActive, requireVerifierAccess, async (req, res) => {
  try {
    const earnings = await verifierManager.getVerifierEarnings(req.user.id);
    res.json(earnings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/verifier/rate
 * User rates the verifier after completion (1-5 stars)
 */
verifierRouter.post('/rate', requireAuth, requireActive, async (req, res) => {
  try {
    const { commitmentId, verifierId, rating, comment } = req.body;
    if (!commitmentId || !verifierId || !rating) {
      return res.status(400).json({ error: 'commitmentId, verifierId, and rating are required' });
    }

    const result = await verifierManager.submitRating({
      commitmentId,
      verifierId,
      raterUserId: req.user.id,
      rating,
      comment
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/verifier/evidence/:commitmentId
 * Retrieves private evidence with strict access control
 */
verifierRouter.get('/evidence/:commitmentId', requireAuth, requireActive, async (req, res) => {
  try {
    const evidence = await verifierManager.getEvidenceForCommitment(
      req.params.commitmentId,
      req.user.id,
      req.profile.role
    );
    res.json({ evidence });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

/**
 * POST /api/verifier/evidence/:requestId
 * Uploads evidence for a verification request
 */
verifierRouter.post('/evidence/:requestId', requireAuth, requireActive, async (req, res) => {
  try {
    const { mediaUrl, description, mediaType } = req.body;
    if (!mediaUrl) return res.status(400).json({ error: 'mediaUrl is required' });

    const evidence = await verifierManager.submitEvidence(req.params.requestId, req.user.id, {
      mediaUrl,
      description,
      mediaType
    });
    res.status(201).json({ message: 'Evidence recorded with SHA-256 integrity hash', evidence });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
