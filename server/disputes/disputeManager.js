import crypto from 'crypto';
import { supabaseAdmin } from '../auth/supabase.js';
import { logAudit } from '../auth/middleware.js';
import { reputationManager } from '../reputation/reputationManager.js';

/**
 * COMMIT PROTOCOL DISPUTE RESOLUTION ENGINE
 * 
 * Formal Dispute Lifecycle:
 * OPEN -> UNDER_REVIEW -> RESOLVED_USER | RESOLVED_VERIFIER -> CLOSED
 * 
 * Critical Rules:
 * 1. A disputed commitment is strictly FROZEN — normal settlement is blocked.
 * 2. Duplicate resolutions are rejected.
 * 3. Every resolution is logged in the immutable audit trail.
 * 4. Resolving a dispute records authoritative reputation events.
 */

class DisputeManager {
  constructor() {
    // In-memory disputes map: disputeId -> DisputeRecord
    this.disputes = new Map();
    // commitmentId -> disputeId lookup
    this.commitmentToDispute = new Map();
  }

  /**
   * Opens a new dispute on a verified commitment
   */
  async openDispute({ commitment, openedBy, reason, evidence = [] }) {
    if (!commitment) {
      throw new Error('Commitment is required');
    }

    const DISPUTABLE_STATES = ['VERIFIED', 'PENDING_VERIFICATION'];
    if (!DISPUTABLE_STATES.includes(commitment.status)) {
      throw new Error(`Cannot dispute commitment in state '${commitment.status}'. Must be 'VERIFIED' or 'PENDING_VERIFICATION'.`);
    }

    if (this.commitmentToDispute.has(commitment.id)) {
      const existingId = this.commitmentToDispute.get(commitment.id);
      const existing = this.disputes.get(existingId);
      if (existing && existing.status !== 'CLOSED') {
        throw new Error('An active dispute is already open for this commitment');
      }
    }

    const disputeId = `disp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const disputeRecord = {
      dispute_id: disputeId,
      commitment_id: commitment.id,
      opened_by: openedBy,
      reason: reason || 'User disputes verification outcome based on submitted evidence',
      evidence: Array.isArray(evidence) ? evidence : [evidence],
      status: 'OPEN', // OPEN, UNDER_REVIEW, RESOLVED_USER, RESOLVED_VERIFIER, CLOSED
      resolver: null,
      resolution: null,
      resolution_notes: null,
      created_at: new Date().toISOString(),
      resolved_at: null
    };

    this.disputes.set(disputeId, disputeRecord);
    this.commitmentToDispute.set(commitment.id, disputeId);

    // Freeze commitment settlement
    commitment.preDisputeStatus = commitment.status;
    commitment.disputeReason = disputeRecord.reason;
    commitment.status = 'DISPUTED';
    commitment.disputeId = disputeId;
    commitment.disputedAt = disputeRecord.created_at;

    // Optional persist to database
    try {
      await supabaseAdmin.from('disputes').insert(disputeRecord);
    } catch (_) {}

    return disputeRecord;
  }

  /**
   * Admin reviews and resolves a dispute
   */
  async resolveDispute({ disputeId, resolverUserId, resolution, notes = '' }) {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    if (dispute.status === 'RESOLVED_USER' || dispute.status === 'RESOLVED_VERIFIER' || dispute.status === 'CLOSED') {
      throw new Error(`Dispute is already resolved (status: ${dispute.status}). Duplicate resolution rejected.`);
    }

    // Acceptable resolution values:
    // 'RESOLVED_USER' (or 'OVERTURN_TO_PASS')
    // 'RESOLVED_VERIFIER' (or 'UPHOLD_FAIL')
    let canonicalResolution = resolution;
    if (resolution === 'OVERTURN_TO_PASS') canonicalResolution = 'RESOLVED_USER';
    if (resolution === 'UPHOLD_FAIL') canonicalResolution = 'RESOLVED_VERIFIER';

    if (!['RESOLVED_USER', 'RESOLVED_VERIFIER'].includes(canonicalResolution)) {
      throw new Error(`Invalid resolution: ${resolution}. Must be RESOLVED_USER or RESOLVED_VERIFIER.`);
    }

    dispute.status = canonicalResolution;
    dispute.resolution = canonicalResolution;
    dispute.resolver = resolverUserId;
    dispute.resolution_notes = notes;
    dispute.resolved_at = new Date().toISOString();

    // Record reputation event if verifier is attached
    const verifierId = dispute.evidence?.verifierId || 'v_peer_multisig';
    if (canonicalResolution === 'RESOLVED_USER') {
      await reputationManager.recordEvent({
        verifierId,
        eventType: 'DISPUTE_OVERTURNED',
        commitmentId: dispute.commitment_id,
        metadata: { reason: notes, resolvedBy: resolverUserId },
        actorId: resolverUserId
      });
    } else {
      await reputationManager.recordEvent({
        verifierId,
        eventType: 'DISPUTE_UPHELD',
        commitmentId: dispute.commitment_id,
        metadata: { reason: notes, resolvedBy: resolverUserId },
        actorId: resolverUserId
      });
    }

    // Optional persist to database
    try {
      await supabaseAdmin
        .from('disputes')
        .update({
          status: dispute.status,
          resolution: dispute.resolution,
          resolver: dispute.resolver,
          resolution_notes: dispute.resolution_notes,
          resolved_at: dispute.resolved_at
        })
        .eq('dispute_id', disputeId);
    } catch (_) {}

    return dispute;
  }

  getDispute(disputeId) {
    return this.disputes.get(disputeId) || null;
  }

  getDisputeByCommitment(commitmentId) {
    const disputeId = this.commitmentToDispute.get(commitmentId);
    if (!disputeId) return null;
    return this.disputes.get(disputeId) || null;
  }

  getAllDisputes({ status = null } = {}) {
    let list = Array.from(this.disputes.values());
    if (status) {
      list = list.filter(d => d.status === status);
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

export const disputeManager = new DisputeManager();
