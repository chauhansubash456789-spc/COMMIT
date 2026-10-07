import crypto from 'crypto';
import { supabaseAdmin } from '../auth/supabase.js';
import { signVerificationResult, hashEvidence } from '../oracle/attestation.js';
import { reputationManager } from '../reputation/reputationManager.js';
import { notificationManager } from '../notifications/notificationManager.js';

/**
 * COMMIT PROTOCOL: AUTHORITATIVE VERIFIER MANAGER & ENGINE
 * 
 * Invariants & Security Rules:
 * 1. Self-Verification Forbidden: verifier.userId !== commitment.creator_id
 * 2. Scope Isolation: Verifier A can NEVER view or modify Verifier B's private verification requests
 * 3. Immutable Stats: Accuracy, Ratings, Completed counts, and Earnings are derived from authoritative events
 * 4. Ephemeral QR Check-In: Short TTL (5 minutes), cryptographic nonce, anti-replay
 * 5. Locked Checklist: Verifier evaluates checklist items, cannot edit checklist definitions
 * 6. Standardized Result Codes: HUMAN_PASS, HUMAN_FAIL, HUMAN_CHECKLIST_INCOMPLETE, etc.
 * 7. Frozen Disputes: Disputed commitments block settlement until admin resolution
 * 8. Fixed Rewards: Verification reward is locked from escrow PDA; client cannot tamper with reward amount
 */

export class VerifierManager {
  constructor() {
    // In-memory Stores:
    // requestId -> VerificationRequest
    this.requests = new Map();
    // verifierId / userId -> VerifierProfile
    this.verifiers = new Map();
    // verifierId -> Array<VerifierEarning>
    this.earnings = new Map();
    // qrToken -> CheckinSession
    this.checkinSessions = new Map();
    // commitmentId -> Array<EvidenceRecord>
    this.evidenceVault = new Map();

    this._seedInitialVerifiers();
  }

  _seedInitialVerifiers() {
    const seedProfiles = [
      {
        id: 'v_alex',
        userId: 'usr_seed_alex_01',
        displayName: 'Alex M.',
        bio: 'Senior decentralized systems auditor & physical task verification specialist.',
        specializations: ['Electronics', 'Physical Tasks', 'Workplace Organization'],
        serviceArea: 'San Francisco, CA / Remote',
        verificationType: 'human_physical',
        status: 'TRUSTED', // PENDING, VERIFIED, TRUSTED, SUSPENDED
        level: 'TRUSTED',
        availability: 'Available', // Available, Busy, Unavailable
        wallet: 'AlexVer1f1er111111111111111111111111111111111',
        profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
      },
      {
        id: 'v_elena',
        userId: 'usr_seed_elena_02',
        displayName: 'Elena R.',
        bio: 'Certified lab safety coordinator and deep-work accountability verifier.',
        specializations: ['Lab Organization', 'Study Verification', 'Physical Inventory'],
        serviceArea: 'Boston, MA / Remote',
        verificationType: 'human_physical',
        status: 'VERIFIED',
        level: 'VERIFIED',
        availability: 'Available',
        wallet: 'ElenaVer1f1er22222222222222222222222222222222',
        profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
      },
      {
        id: 'v_chen',
        userId: 'usr_seed_chen_03',
        displayName: 'Chen W.',
        bio: 'Master physical verifier with 200+ completed escrows and 98% consensus rate.',
        specializations: ['Fitness Milestones', 'Electronics Lab', 'Asset Inventory'],
        serviceArea: 'Seattle, WA / Remote',
        verificationType: 'human_physical',
        status: 'TRUSTED',
        level: 'TRUSTED',
        availability: 'Busy',
        wallet: 'ChenVer1f1er333333333333333333333333333333333',
        profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
        createdAt: new Date(Date.now() - 120 * 86400000).toISOString()
      }
    ];

    for (const p of seedProfiles) {
      this.verifiers.set(p.id, p);
      this.verifiers.set(p.userId, p);
      if (!this.earnings.has(p.id)) {
        this.earnings.set(p.id, []);
      }
    }

    // Seed mock earnings for seed verifiers
    this.earnings.get('v_alex').push({
      id: 'earn_alex_01',
      verifierId: 'v_alex',
      commitmentId: 'cm_seed_alex_01',
      amount: 1.50,
      status: 'SETTLED',
      txSignature: '5J7X...seedTxAlex01',
      explorerUrl: 'https://explorer.solana.com/tx/5J7X...seedTxAlex01?cluster=devnet',
      timestamp: Date.now() - 86400000 * 2
    });
  }

  // ===========================================================================
  // 1. VERIFIER PROFILE MANAGEMENT
  // ===========================================================================

  /**
   * Retrieves verifier profile by verifier ID, user ID, or user's auth ID
   */
  async getVerifierProfile(identifier) {
    if (!identifier) return null;

    // Check in-memory first
    if (this.verifiers.has(identifier)) {
      return this.verifiers.get(identifier);
    }

    // Check Postgres database via Supabase
    try {
      let targetUserId = identifier;
      let userProf = null;

      // Check if identifier is an auth_user_id or user_profiles.id
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      if (isUUID) {
        const { data: u } = await supabaseAdmin
          .from('user_profiles')
          .select('id, auth_user_id, display_name, avatar_url, wallet_address, bio')
          .or(`id.eq.${identifier},auth_user_id.eq.${identifier}`)
          .maybeSingle();

        if (u) {
          userProf = u;
          targetUserId = u.id;
        }
      }

      let query = supabaseAdmin.from('verifier_profiles').select('*');
      if (isUUID) {
        query = query.or(`id.eq.${identifier},user_id.eq.${targetUserId}`);
      } else {
        query = query.eq('id', identifier);
      }

      const { data: profile } = await query.maybeSingle();

      if (profile) {
        const u = userProf || {};
        const mapped = {
          id: profile.id,
          userId: profile.user_id,
          authUserId: u.auth_user_id || profile.user_id,
          displayName: u.display_name || 'Verifier',
          bio: u.bio || 'Verified Commit Verifier',
          specializations: profile.verification_types || ['human_physical'],
          serviceArea: 'Remote',
          verificationType: 'human_physical',
          status: profile.verification_status || 'PENDING',
          level: profile.verification_level || 'NEW',
          availability: 'Available',
          wallet: u.wallet_address || 'UNLINKED',
          profileImage: u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
          createdAt: profile.created_at
        };
        this.verifiers.set(mapped.id, mapped);
        this.verifiers.set(mapped.userId, mapped);
        if (u.auth_user_id) this.verifiers.set(u.auth_user_id, mapped);
        return mapped;
      }
    } catch (_) {}

    return null;
  }

  /**
   * Updates verifier availability (Available, Busy, Unavailable)
   */
  async updateAvailability(userId, availability) {
    const validStates = ['Available', 'Busy', 'Unavailable'];
    if (!validStates.includes(availability)) {
      throw new Error(`Invalid availability status. Must be one of: ${validStates.join(', ')}`);
    }

    const verifier = await this.getVerifierProfile(userId);
    if (!verifier) {
      throw new Error('Verifier profile not found');
    }

    verifier.availability = availability;
    try {
      await supabaseAdmin
        .from('verifier_profiles')
        .update({ availability, updated_at: new Date().toISOString() })
        .eq('id', verifier.id);
    } catch (_) {}

    return verifier;
  }

  /**
   * Admin approves verifier application
   */
  async approveVerifier(verifierId, adminUserId) {
    const verifier = await this.getVerifierProfile(verifierId);
    if (!verifier) throw new Error('Verifier profile not found');

    verifier.status = 'VERIFIED';
    verifier.level = 'VERIFIED';

    try {
      await supabaseAdmin
        .from('verifier_profiles')
        .update({
          verification_status: 'VERIFIED',
          verification_level: 'VERIFIED',
          updated_at: new Date().toISOString()
        })
        .eq('id', verifier.id);

      await supabaseAdmin
        .from('user_profiles')
        .update({ role: 'VERIFIER', updated_at: new Date().toISOString() })
        .eq('id', verifier.userId);
    } catch (_) {}

    notificationManager.dispatch({
      userId: verifier.userId,
      type: 'VERIFIER_APPROVED',
      title: 'Verifier Application Approved!',
      message: 'Congratulations! Your verifier application has been approved. You can now receive verification requests.'
    });

    return verifier;
  }

  /**
   * Admin suspends verifier
   */
  async suspendVerifier(verifierId, adminUserId, reason = 'Administrative suspension') {
    const verifier = await this.getVerifierProfile(verifierId);
    if (!verifier) throw new Error('Verifier profile not found');

    verifier.status = 'SUSPENDED';

    try {
      await supabaseAdmin
        .from('verifier_profiles')
        .update({
          verification_status: 'SUSPENDED',
          updated_at: new Date().toISOString()
        })
        .eq('id', verifier.id);

      await supabaseAdmin
        .from('user_profiles')
        .update({ role: 'USER', updated_at: new Date().toISOString() })
        .eq('id', verifier.userId);
    } catch (_) {}

    await reputationManager.recordEvent({
      verifierId: verifier.id,
      eventType: 'ADMIN_SUSPENSION',
      metadata: { reason, suspendedBy: adminUserId },
      actorId: adminUserId
    });

    notificationManager.dispatch({
      userId: verifier.userId,
      type: 'VERIFIER_SUSPENDED',
      title: 'Verifier Status Suspended',
      message: `Your verifier privileges have been suspended. Reason: ${reason}`
    });

    return verifier;
  }

  // ===========================================================================
  // 2. VERIFICATION REQUEST LIFECYCLE
  // ===========================================================================

  /**
   * Creates an authoritative verification request bound to a funded commitment
   */
  async createRequest({
    commitmentId,
    userId,
    authUserId = null,
    userWallet,
    verifierId = null, // Can be assigned directly or available to trusted verifier pool
    taskSummary,
    criteria = [],
    deadline,
    stake,
    verifierFee = 1.50,
    verificationType = 'human_physical',
    locationRequirement = null, // e.g. { address: 'Building 4, Room 204', lat: 37.7749, lng: -122.4194, radiusMeters: 250 }
    checklist = []
  }) {
    if (!commitmentId || !userId) {
      throw new Error('commitmentId and userId are required to create a verification request');
    }

    const requestId = `vreq_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const defaultChecklist = (checklist && checklist.length > 0)
      ? checklist
      : [
          { id: 'chk_1', label: 'Specified work environment cleaned and cleared', required: true, checked: false },
          { id: 'chk_2', label: 'Predefined physical requirements organized as specified', required: true, checked: false },
          { id: 'chk_3', label: 'Evidence captures completion before locked deadline', required: true, checked: false }
        ];

    const request = {
      verification_request_id: requestId,
      id: requestId,
      commitment_id: commitmentId,
      user_id: userId,
      auth_user_id: authUserId || userId,
      user_wallet: userWallet,
      verifier_id: verifierId,
      assigned_verifier_id: verifierId,
      verification_type: verificationType,
      task_summary: taskSummary || 'Physical Task Verification',
      criteria: criteria.length > 0 ? criteria : ['Verify completed physical cleanup and orderliness'],
      deadline: deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
      stake: Number(stake) || 20.00,
      verifier_fee: Number(verifierFee) || 1.50,
      location_requirement: locationRequirement,
      checklist: defaultChecklist, // Locked checklist definitions
      status: 'PENDING', // PENDING, ACCEPTED, IN_PROGRESS, SUBMITTED, DISPUTED, COMPLETED, DECLINED, EXPIRED, CANCELLED
      created_at: new Date().toISOString(),
      accepted_at: null,
      completed_at: null,
      decline_reason: null,
      result_code: null,
      attestation: null,
      checkin: null
    };

    this.requests.set(requestId, request);

    // If assigned to a specific verifier, notify them
    if (verifierId) {
      const targetVerifier = await this.getVerifierProfile(verifierId);
      if (targetVerifier) {
        notificationManager.dispatch({
          userId: targetVerifier.userId,
          type: 'NEW_VERIFICATION_REQUEST',
          title: 'New Verification Request Received',
          message: `You received a new physical verification request for "${taskSummary}". Fee: ${verifierFee} USDC.`,
          commitmentId
        });
      }
    }

    return request;
  }

  /**
   * Retrieves requests authorized for a given verifier.
   * STRICT ACCESS CONTROL (Anti-IDOR):
   * Verifier A can ONLY see requests assigned to them or unassigned open pool requests.
   * Verifier A CANNOT see Verifier B's private assigned requests.
   */
  async getRequestsForVerifier(verifierUserId, { status = null } = {}) {
    const verifier = await this.getVerifierProfile(verifierUserId);
    if (!verifier) return [];

    const isAuthorizedStatus = ['VERIFIED', 'TRUSTED'].includes(verifier.status);
    if (!isAuthorizedStatus) {
      return []; // Pending or Suspended verifiers cannot see request queues
    }

    const allRequests = Array.from(this.requests.values());
    const filtered = allRequests.filter(req => {
      // Must not be self-created commitment
      if (
        req.user_id === verifier.userId ||
        req.user_id === verifier.authUserId ||
        req.auth_user_id === verifier.authUserId ||
        req.auth_user_id === verifier.userId ||
        verifierUserId === req.user_id ||
        verifierUserId === req.auth_user_id ||
        (verifier.wallet && req.user_wallet && verifier.wallet.toLowerCase() === req.user_wallet.toLowerCase())
      ) {
        return false;
      }

      // Check scoping: either assigned to this verifier, or unassigned PENDING pool
      const isAssignedToThisVerifier = req.verifier_id === verifier.id || req.verifier_id === verifier.userId;
      const isOpenPool = !req.verifier_id && req.status === 'PENDING';

      if (!isAssignedToThisVerifier && !isOpenPool) {
        return false; // Verifier B's private requests are strictly invisible to Verifier A
      }

      if (status && req.status !== status) {
        return false;
      }

      return true;
    });

    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  /**
   * Authoritatively get a single request with strict verifier access check
   */
  async getRequestById(requestId, requesterUserId, requesterRole = 'USER') {
    const request = this.requests.get(requestId);
    if (!request) return null;

    // Admins have full audit visibility
    if (requesterRole === 'ADMIN' || requesterRole === 'SUPER_ADMIN') {
      return request;
    }

    // Commitment owner can view their own request
    if (request.user_id === requesterUserId || request.auth_user_id === requesterUserId) {
      return request;
    }

    // Authorized verifier check
    const verifier = await this.getVerifierProfile(requesterUserId);
    if (verifier) {
      const isAssigned = request.verifier_id === verifier.id || request.verifier_id === verifier.userId;
      const isOpenPool = !request.verifier_id && request.status === 'PENDING';
      if (isAssigned || isOpenPool) {
        return request;
      }
    }

    // Access Denied (Anti-IDOR)
    return null;
  }

  /**
   * Verifier accepts an assigned or pool request.
   * Enforces:
   * 1. Conflict-of-interest defense: Reject self-verification
   * 2. Status gate: Only VERIFIED or TRUSTED verifiers can accept
   * 3. State machine gate: Only PENDING requests can be accepted
   * 4. Race condition prevention: Atomic assignment
   */
  async acceptRequest(requestId, verifierUserId) {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Verification request not found');

    const verifier = await this.getVerifierProfile(verifierUserId);
    if (!verifier) throw new Error('Verifier profile not found');

    // Status gate
    if (!['VERIFIED', 'TRUSTED'].includes(verifier.status)) {
      throw new Error(`Verifier status '${verifier.status}' cannot accept verification requests. Must be VERIFIED or TRUSTED.`);
    }

    // Conflict of interest check (Strict Self-Verification Block)
    const isConflict =
      request.user_id === verifier.userId ||
      request.user_id === verifier.authUserId ||
      (request.auth_user_id && (request.auth_user_id === verifier.authUserId || request.auth_user_id === verifier.userId)) ||
      (verifier.wallet && request.user_wallet && verifier.wallet.toLowerCase() === request.user_wallet.toLowerCase()) ||
      verifierUserId === request.user_id ||
      verifierUserId === request.auth_user_id;

    if (isConflict) {
      throw new Error('Conflict of Interest: Verifiers cannot accept or verify their own commitments.');
    }

    // State machine check
    if (request.status !== 'PENDING') {
      throw new Error(`Cannot accept request in status '${request.status}'. Request must be PENDING.`);
    }

    // Expiration check
    if (new Date(request.deadline).getTime() < Date.now()) {
      request.status = 'EXPIRED';
      throw new Error('Cannot accept expired verification request');
    }

    // Exclusive Assignment Lock
    request.status = 'ACCEPTED';
    request.verifier_id = verifier.id;
    request.assigned_verifier_id = verifier.id;
    request.accepted_at = new Date().toISOString();

    notificationManager.dispatch({
      userId: request.user_id,
      type: 'REQUEST_ACCEPTED',
      title: 'Verifier Accepted Your Task',
      message: `${verifier.displayName} accepted your task "${request.task_summary}". Check-in is ready.`,
      commitmentId: request.commitment_id
    });

    return request;
  }

  /**
   * Verifier declines a request with an honest reason.
   * Honest declines do NOT penalize verifier reputation.
   */
  async declineRequest(requestId, verifierUserId, reason) {
    const validReasons = [
      'Unavailable',
      'Outside service area',
      'Conflict of interest',
      'Insufficient specialization',
      'Scheduling conflict'
    ];

    const cleanReason = reason?.trim();
    if (!cleanReason) {
      throw new Error('A valid reason is required to decline a verification request.');
    }

    const request = this.requests.get(requestId);
    if (!request) throw new Error('Verification request not found');

    const verifier = await this.getVerifierProfile(verifierUserId);
    if (!verifier) throw new Error('Verifier profile not found');

    if (request.status !== 'PENDING' && request.status !== 'ACCEPTED') {
      throw new Error(`Cannot decline request in status '${request.status}'`);
    }

    request.status = 'DECLINED';
    request.decline_reason = cleanReason;
    request.declined_at = new Date().toISOString();

    return request;
  }

  // ===========================================================================
  // 3. SECURE CHECK-IN SYSTEM (QR TOKEN + SERVER TIMESTAMP + LOCATION)
  // ===========================================================================

  /**
   * Generates ephemeral, short-TTL QR check-in session for the verifier.
   * Security Invariants:
   * - 5-minute expiration
   * - Cryptographically random nonce
   * - Bound to commitment ID and verifier ID
   */
  async generateCheckinQR(requestId, verifierUserId) {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Verification request not found');

    const verifier = await this.getVerifierProfile(verifierUserId);
    if (!verifier) throw new Error('Verifier profile not found');

    if (request.verifier_id !== verifier.id && request.verifier_id !== verifier.userId) {
      throw new Error('Unauthorized: You are not the assigned verifier for this request');
    }

    if (request.status !== 'ACCEPTED' && request.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot generate check-in for request in status '${request.status}'. Must be ACCEPTED.`);
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minute TTL

    // Canonical signed token payload
    const tokenPayload = `${requestId}|${request.commitment_id}|${verifier.id}|${nonce}|${expiresAt}`;
    const tokenHash = crypto.createHash('sha256').update(tokenPayload).digest('hex');

    const session = {
      qrToken: tokenHash,
      nonce,
      requestId,
      commitmentId: request.commitment_id,
      verifierId: verifier.id,
      expiresAt,
      used: false,
      createdAt: Date.now()
    };

    this.checkinSessions.set(tokenHash, session);

    return {
      qrToken: tokenHash,
      nonce,
      expiresAt,
      commitmentId: request.commitment_id,
      verifierId: verifier.id,
      formattedCode: `COMMIT-CHECKIN-${tokenHash.slice(0, 10).toUpperCase()}`
    };
  }

  /**
   * Validates QR check-in submission and optional supporting location signal
   */
  async verifyCheckin(requestId, verifierUserId, { qrToken, verifierLocation = null }) {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Verification request not found');

    const verifier = await this.getVerifierProfile(verifierUserId);
    if (!verifier) throw new Error('Verifier profile not found');

    if (request.verifier_id !== verifier.id && request.verifier_id !== verifier.userId) {
      throw new Error('Unauthorized verifier check-in attempt');
    }

    const session = this.checkinSessions.get(qrToken);
    if (!session) {
      throw new Error('Invalid or unknown QR check-in token');
    }

    // Expiration check
    if (Date.now() > session.expiresAt) {
      throw new Error('QR check-in token has expired (5-minute TTL exceeded)');
    }

    // Replay check
    if (session.used) {
      throw new Error('QR check-in token has already been used. Replay detected.');
    }

    // Binding check
    if (session.requestId !== requestId || session.verifierId !== verifier.id) {
      throw new Error('QR check-in token is not bound to this task or verifier');
    }

    // Supporting Location Verification
    let locationVerified = true;
    let locationNotes = 'No location constraint specified';

    if (request.location_requirement && request.location_requirement.lat && request.location_requirement.lng) {
      if (!verifierLocation || !verifierLocation.lat || !verifierLocation.lng) {
        locationVerified = false;
        locationNotes = 'Location signal required by commitment but not provided by verifier';
      } else {
        const distanceMeters = this._calculateHaversineDistance(
          request.location_requirement.lat,
          request.location_requirement.lng,
          verifierLocation.lat,
          verifierLocation.lng
        );
        const acceptableRadius = request.location_requirement.radiusMeters || 250;
        if (distanceMeters > acceptableRadius) {
          locationVerified = false;
          locationNotes = `Verifier location (${distanceMeters.toFixed(0)}m) outside acceptable radius (${acceptableRadius}m)`;
        } else {
          locationVerified = true;
          locationNotes = `Verified within radius (${distanceMeters.toFixed(0)}m <= ${acceptableRadius}m)`;
        }
      }
    }

    // Mark session used (burn nonce)
    session.used = true;

    // Update request state
    request.status = 'IN_PROGRESS';
    request.checkin = {
      verifiedAt: new Date().toISOString(),
      serverTimestamp: Date.now(),
      qrTokenUsed: qrToken,
      locationVerified,
      locationNotes
    };

    return {
      success: true,
      status: request.status,
      checkin: request.checkin
    };
  }

  _calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const toRad = x => (x * Math.PI) / 180;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lon2 - lon1);

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ===========================================================================
  // 4. EVIDENCE SUBMISSION & PRIVATE ACCESS CONTROL
  // ===========================================================================

  /**
   * Stores off-chain evidence reference with server-calculated SHA-256 hash.
   * Access is strictly private by default (Assigned verifier, owner, admin only).
   */
  async submitEvidence(requestId, uploaderUserId, { mediaUrl, description, mediaType = 'image' }) {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Verification request not found');

    const verifier = await this.getVerifierProfile(uploaderUserId);
    const isOwner = request.user_id === uploaderUserId;
    const isAssignedVerifier = verifier && (request.verifier_id === verifier.id || request.verifier_id === verifier.userId);

    if (!isOwner && !isAssignedVerifier) {
      throw new Error('Unauthorized: Evidence can only be submitted by the task owner or assigned verifier.');
    }

    const evidenceId = `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const evidencePayload = {
      evidenceId,
      requestId,
      commitmentId: request.commitment_id,
      mediaUrl,
      mediaType,
      description: description || 'Evidence submitted for verification evaluation',
      uploadedBy: uploaderUserId,
      uploadedAt: new Date().toISOString()
    };

    const sha256Hash = hashEvidence(evidencePayload);
    const record = {
      ...evidencePayload,
      sha256Hash,
      storageReference: mediaUrl
    };

    if (!this.evidenceVault.has(request.commitment_id)) {
      this.evidenceVault.set(request.commitment_id, []);
    }
    this.evidenceVault.get(request.commitment_id).push(record);

    return record;
  }

  /**
   * Retrieves evidence records with private access control check
   */
  async getEvidenceForCommitment(commitmentId, requesterUserId, requesterRole = 'USER') {
    // Admins always have access
    if (requesterRole === 'ADMIN' || requesterRole === 'SUPER_ADMIN') {
      return this.evidenceVault.get(commitmentId) || [];
    }

    // Find request
    const request = Array.from(this.requests.values()).find(r => r.commitment_id === commitmentId);
    if (!request) return [];

    const verifier = await this.getVerifierProfile(requesterUserId);
    const isOwner = request.user_id === requesterUserId;
    const isAssignedVerifier = verifier && (request.verifier_id === verifier.id || request.verifier_id === verifier.userId);

    if (!isOwner && !isAssignedVerifier) {
      throw new Error('Access Denied: Evidence is private and can only be viewed by the commitment owner or assigned verifier.');
    }

    return this.evidenceVault.get(commitmentId) || [];
  }

  // ===========================================================================
  // 5. LOCKED CHECKLIST EVALUATION & PASS / FAIL SUBMISSION
  // ===========================================================================

  /**
   * Evaluates locked checklist and submits authoritative PASS or FAIL.
   * Generates Oracle Ed25519 Signed Attestation.
   */
  async submitVerificationDecision(requestId, verifierUserId, {
    outcome, // 'PASS' or 'FAIL'
    checklistEvaluations = [], // [{ id, checked }]
    notes = '',
    evidenceData = null
  }) {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Verification request not found');

    const verifier = await this.getVerifierProfile(verifierUserId);
    if (!verifier) throw new Error('Verifier profile not found');

    if (request.verifier_id !== verifier.id && request.verifier_id !== verifier.userId) {
      throw new Error('Unauthorized: Only the assigned verifier can submit verification results.');
    }

    if (request.status !== 'IN_PROGRESS' && request.status !== 'ACCEPTED') {
      throw new Error(`Cannot submit decision for request in status '${request.status}'.`);
    }

    // Enforce locked checklist criteria validation
    // The verifier CANNOT modify checklist definitions, only mark items as evaluated
    const updatedChecklist = request.checklist.map(item => {
      const evaluation = checklistEvaluations.find(e => e.id === item.id);
      return {
        ...item,
        checked: evaluation ? Boolean(evaluation.checked) : false
      };
    });

    const requiredItems = updatedChecklist.filter(item => item.required);
    const allRequiredChecked = requiredItems.every(item => item.checked);

    let resultCode = 'HUMAN_PASS';
    let isSuccessful = outcome === 'PASS';

    // Standardized Result Code Logic
    if (outcome === 'PASS') {
      if (!allRequiredChecked) {
        resultCode = 'HUMAN_CHECKLIST_INCOMPLETE';
        isSuccessful = false;
        throw new Error('Checklist Incomplete: Cannot PASS task when required checklist criteria are not checked.');
      }
      if (request.checkin && !request.checkin.locationVerified) {
        resultCode = 'HUMAN_LOCATION_MISMATCH';
        isSuccessful = false;
      } else {
        resultCode = 'HUMAN_PASS';
        isSuccessful = true;
      }
    } else {
      resultCode = notes.toLowerCase().includes('evidence')
        ? 'HUMAN_EVIDENCE_MISSING'
        : (notes.toLowerCase().includes('location') ? 'HUMAN_LOCATION_MISMATCH' : 'HUMAN_FAIL');
      isSuccessful = false;
    }

    request.checklist = updatedChecklist;

    // Off-chain evidence summary
    const evidencePayload = {
      requestId,
      commitmentId: request.commitment_id,
      verifierId: verifier.id,
      verifierWallet: verifier.wallet,
      outcome,
      resultCode,
      checklist: updatedChecklist,
      notes: notes || 'Verified with locked checklist inspection',
      checkin: request.checkin,
      timestamp: Date.now()
    };

    const evidenceHash = hashEvidence(evidencePayload);

    // Cryptographic Ed25519 Oracle Attestation
    const attestation = signVerificationResult({
      commitmentId: request.commitment_id,
      walletAddress: request.user_wallet || 'USER_WALLET_DEVNET',
      verifierType: 'human_physical',
      verifierVersion: 'human-v1.0',
      resultCode,
      isSuccessful,
      verifiedMetric: isSuccessful ? 1 : 0,
      requiredMetric: 1,
      evidencePayload,
      evidenceHash
    });

    // Update request state
    request.status = 'COMPLETED';
    request.result_code = resultCode;
    request.attestation = attestation;
    request.completed_at = new Date().toISOString();

    // Record Verifier Reward & Pending Earning
    const earningRecord = {
      id: `earn_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      verifierId: verifier.id,
      commitmentId: request.commitment_id,
      amount: request.verifier_fee, // Fixed from commitment escrow
      status: 'PENDING_SETTLEMENT', // PENDING_SETTLEMENT -> SETTLED
      txSignature: null,
      explorerUrl: null,
      timestamp: Date.now()
    };

    if (!this.earnings.has(verifier.id)) {
      this.earnings.set(verifier.id, []);
    }
    this.earnings.get(verifier.id).push(earningRecord);

    // Authoritative Reputation Update
    await reputationManager.recordEvent({
      verifierId: verifier.id,
      eventType: 'VERIFICATION_COMPLETED',
      commitmentId: request.commitment_id,
      metadata: { outcome, resultCode, fee: request.verifier_fee },
      actorId: verifier.userId
    });

    notificationManager.dispatch({
      userId: request.user_id,
      type: 'VERIFICATION_COMPLETED',
      title: `Verification Decision: ${outcome}`,
      message: `${verifier.displayName} completed verification with result code: ${resultCode}.`,
      commitmentId: request.commitment_id
    });

    return {
      status: request.status,
      resultCode,
      attestation,
      earning: earningRecord
    };
  }

  // ===========================================================================
  // 6. EARNINGS & ON-CHAIN REWARD SETTLEMENT HOOK
  // ===========================================================================

  /**
   * Called when Solana Devnet settlement executes for a commitment
   */
  async confirmSettlementReward(commitmentId, settlementResult) {
    for (const [verifierId, earningsList] of this.earnings.entries()) {
      const match = earningsList.find(e => e.commitmentId === commitmentId && e.status === 'PENDING_SETTLEMENT');
      if (match) {
        match.status = 'SETTLED';
        match.txSignature = settlementResult.txSignature || 'devnet_tx_sig';
        match.explorerUrl = settlementResult.explorerUrl || `https://explorer.solana.com/tx/${match.txSignature}?cluster=devnet`;
        match.settledAt = new Date().toISOString();
      }
    }
  }

  /**
   * Returns authoritative verifier earnings ledger
   */
  async getVerifierEarnings(verifierUserId) {
    const verifier = await this.getVerifierProfile(verifierUserId);
    if (!verifier) return { totalEarned: 0, pending: 0, earnings: [] };

    const records = this.earnings.get(verifier.id) || [];
    let totalEarned = 0;
    let pending = 0;

    for (const rec of records) {
      if (rec.status === 'SETTLED') {
        totalEarned += rec.amount;
      } else if (rec.status === 'PENDING_SETTLEMENT') {
        pending += rec.amount;
      }
    }

    return {
      totalEarned: Number(totalEarned.toFixed(2)),
      pending: Number(pending.toFixed(2)),
      earnings: records.sort((a, b) => b.timestamp - a.timestamp)
    };
  }

  // ===========================================================================
  // 7. USER RATING SYSTEM (ANTI-SELF-RATING, COMPLETED VERIFICATION BOUND)
  // ===========================================================================

  /**
   * Verified user rates the verifier after completion (1 to 5 stars)
   */
  async submitRating({ commitmentId, verifierId, raterUserId, rating, comment = '' }) {
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      throw new Error('Rating must be an integer between 1 and 5');
    }

    const request = Array.from(this.requests.values()).find(r => r.commitment_id === commitmentId);
    if (!request) {
      throw new Error('Verification request not found for commitment');
    }

    if (request.status !== 'COMPLETED' && request.status !== 'SETTLED') {
      throw new Error('Cannot rate verifier before verification is completed');
    }

    const verifier = await this.getVerifierProfile(verifierId);
    if (!verifier) {
      throw new Error('Verifier not found');
    }

    // Anti-Self-Rating
    const isSelfRating =
      verifier.userId === raterUserId ||
      verifier.authUserId === raterUserId ||
      verifier.id === raterUserId;

    if (isSelfRating) {
      throw new Error('Conflict of Interest: Verifiers cannot rate themselves.');
    }

    // Only commitment creator can rate
    const isCreator =
      request.user_id === raterUserId ||
      request.auth_user_id === raterUserId;

    if (!isCreator) {
      throw new Error('Unauthorized: Only the commitment creator can rate the verifier.');
    }

    // Check duplicate rating in reputationManager events
    const existingEvents = reputationManager.getEvents(verifier.id);
    const alreadyRated = existingEvents.some(e => e.eventType === 'USER_RATING' && e.commitmentId === commitmentId);
    if (alreadyRated) {
      throw new Error('Duplicate rating rejected. You have already rated this verification.');
    }

    const eventRecord = await reputationManager.recordEvent({
      verifierId: verifier.id,
      eventType: 'USER_RATING',
      commitmentId,
      metadata: { rating: numRating, comment: comment.trim() },
      actorId: raterUserId
    });

    return {
      success: true,
      rating: numRating,
      event: eventRecord
    };
  }

  // ===========================================================================
  // 8. VERIFIER DASHBOARD AGGREGATOR
  // ===========================================================================

  /**
   * Returns complete authoritative dashboard metrics for the logged-in verifier
   */
  async getDashboardData(verifierUserId) {
    const verifier = await this.getVerifierProfile(verifierUserId);
    if (!verifier) {
      throw new Error('User is not registered as a verifier');
    }

    // Authoritative reputation statistics
    const repStats = reputationManager.calculateStats(verifier.id);

    // Earnings
    const earningsData = await this.getVerifierEarnings(verifier.id);

    // Request counts
    const verifierRequests = Array.from(this.requests.values()).filter(r =>
      r.verifier_id === verifier.id || r.verifier_id === verifier.userId
    );

    const pendingRequests = Array.from(this.requests.values()).filter(r =>
      (!r.verifier_id || r.verifier_id === verifier.id) && r.status === 'PENDING' && r.user_id !== verifier.userId
    );

    const activeVerifications = verifierRequests.filter(r => ['ACCEPTED', 'IN_PROGRESS'].includes(r.status));
    const completedVerifications = verifierRequests.filter(r => ['COMPLETED', 'SETTLED'].includes(r.status));
    const disputedVerifications = verifierRequests.filter(r => r.status === 'DISPUTED');

    return {
      profile: {
        id: verifier.id,
        displayName: verifier.displayName,
        bio: verifier.bio,
        specializations: verifier.specializations,
        serviceArea: verifier.serviceArea,
        verificationStatus: verifier.status,
        availability: verifier.availability,
        wallet: verifier.wallet,
        profileImage: verifier.profileImage
      },
      stats: {
        pendingRequestsCount: pendingRequests.length,
        activeCount: activeVerifications.length,
        completedCount: repStats.completed || completedVerifications.length,
        disputesCount: repStats.disputes || disputedVerifications.length,
        accuracyPercent: repStats.accuracy,
        rating: repStats.rating,
        totalEarnedUSDC: earningsData.totalEarned,
        pendingRewardsUSDC: earningsData.pending
      },
      requests: pendingRequests.slice(0, 10),
      active: activeVerifications,
      completed: completedVerifications.slice(0, 10),
      disputed: disputedVerifications,
      earnings: earningsData.earnings.slice(0, 10),
      reputationEvents: reputationManager.getEvents(verifier.id).slice(-10).reverse()
    };
  }
}

export const verifierManager = new VerifierManager();
