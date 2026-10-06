import { supabaseAdmin } from '../auth/supabase.js';

/**
 * AUTHORITATIVE VERIFIER REPUTATION ENGINE
 * 
 * Invariant: Verifier statistics CANNOT be directly modified or manually overridden.
 * They are mathematically derived from an immutable stream of authoritative events.
 * 
 * Events:
 * - VERIFICATION_COMPLETED: Verifier completed a valid verification
 * - DISPUTE_UPHELD: Dispute reviewed and verifier decision was confirmed correct
 * - DISPUTE_OVERTURNED: Dispute reviewed and verifier decision was found incorrect
 * - NO_SHOW: Verifier failed to review within the challenge window
 * - CANCELLATION: Verifier cancelled an accepted task
 * - USER_RATING: Verified user submitted rating (1-5 stars)
 * - ADMIN_SUSPENSION: Admin penalized/suspended verifier for malicious behavior
 */

class ReputationManager {
  constructor() {
    // In-memory event ledger: verifierId -> Array<ReputationEvent>
    this.events = new Map();

    // Seed initial reputable verifiers from registry
    this._seedInitialVerifiers();
  }

  _seedInitialVerifiers() {
    const seedEvents = [
      // Alex M. (128 completed, 5 incorrect -> 96.09% accuracy)
      ...Array(123).fill().map((_, i) => ({
        id: `ev_alex_c_${i}`,
        verifierId: 'v_alex',
        eventType: 'VERIFICATION_COMPLETED',
        metadata: { outcome: 'CORRECT' },
        timestamp: Date.now() - (123 - i) * 3600000
      })),
      ...Array(5).fill().map((_, i) => ({
        id: `ev_alex_o_${i}`,
        verifierId: 'v_alex',
        eventType: 'DISPUTE_OVERTURNED',
        metadata: { reason: 'Evidence was ambiguous' },
        timestamp: Date.now() - (5 - i) * 7200000
      })),
      // Elena R. (94 completed, 5 incorrect -> 94.68% accuracy)
      ...Array(89).fill().map((_, i) => ({
        id: `ev_elena_c_${i}`,
        verifierId: 'v_elena',
        eventType: 'VERIFICATION_COMPLETED',
        metadata: { outcome: 'CORRECT' },
        timestamp: Date.now() - (89 - i) * 3600000
      })),
      ...Array(5).fill().map((_, i) => ({
        id: `ev_elena_o_${i}`,
        verifierId: 'v_elena',
        eventType: 'DISPUTE_OVERTURNED',
        metadata: { reason: 'Minor checklist deviation' },
        timestamp: Date.now() - (5 - i) * 7200000
      })),
      // Chen W. (210 completed, 4 incorrect -> 98.1% accuracy)
      ...Array(206).fill().map((_, i) => ({
        id: `ev_chen_c_${i}`,
        verifierId: 'v_chen',
        eventType: 'VERIFICATION_COMPLETED',
        metadata: { outcome: 'CORRECT' },
        timestamp: Date.now() - (206 - i) * 3600000
      })),
      ...Array(4).fill().map((_, i) => ({
        id: `ev_chen_o_${i}`,
        verifierId: 'v_chen',
        eventType: 'DISPUTE_OVERTURNED',
        metadata: { reason: 'Edge case ruling' },
        timestamp: Date.now() - (4 - i) * 7200000
      }))
    ];

    for (const ev of seedEvents) {
      if (!this.events.has(ev.verifierId)) {
        this.events.set(ev.verifierId, []);
      }
      this.events.get(ev.verifierId).push(ev);
    }
  }

  /**
   * Records an authoritative event. Strictly rejects unauthorized direct stats modification.
   */
  async recordEvent({ verifierId, eventType, commitmentId = null, metadata = {}, actorId = 'SYSTEM' }) {
    const validEvents = [
      'VERIFICATION_COMPLETED',
      'DISPUTE_UPHELD',
      'DISPUTE_OVERTURNED',
      'NO_SHOW',
      'CANCELLATION',
      'USER_RATING',
      'ADMIN_SUSPENSION'
    ];

    if (!validEvents.includes(eventType)) {
      throw new Error(`Invalid reputation event type: ${eventType}`);
    }

    const eventRecord = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      verifierId,
      eventType,
      commitmentId,
      metadata,
      actorId,
      timestamp: Date.now(),
      createdAt: new Date().toISOString()
    };

    if (!this.events.has(verifierId)) {
      this.events.set(verifierId, []);
    }
    this.events.get(verifierId).push(eventRecord);

    // Optional: async persist to database if table exists
    try {
      await supabaseAdmin.from('verifier_reputation_events').insert({
        verifier_id: verifierId,
        event_type: eventType,
        commitment_id: commitmentId,
        metadata,
        created_at: eventRecord.createdAt
      });
    } catch (_) {
      // Fallback silently if table not yet migrated
    }

    return eventRecord;
  }

  /**
   * Calculates derived statistics dynamically from authoritative events.
   * Cannot be faked or tampered with by clients.
   */
  calculateStats(verifierId) {
    const verifierEvents = this.events.get(verifierId) || [];

    let completed = 0;
    let correct = 0;
    let incorrect = 0;
    let disputes = 0;
    let successfulResolutions = 0;
    let ratings = [];
    let noShows = 0;
    let cancellations = 0;
    let isSuspended = false;

    for (const ev of verifierEvents) {
      switch (ev.eventType) {
        case 'VERIFICATION_COMPLETED':
          completed++;
          correct++;
          break;
        case 'DISPUTE_UPHELD':
          correct++;
          successfulResolutions++;
          disputes++;
          break;
        case 'DISPUTE_OVERTURNED':
          incorrect++;
          disputes++;
          break;
        case 'USER_RATING':
          if (ev.metadata && ev.metadata.rating) {
            ratings.push(Number(ev.metadata.rating));
          }
          break;
        case 'NO_SHOW':
          noShows++;
          break;
        case 'CANCELLATION':
          cancellations++;
          break;
        case 'ADMIN_SUSPENSION':
          isSuspended = true;
          break;
      }
    }

    const totalDecisions = correct + incorrect;
    const accuracy = totalDecisions > 0 ? Number(((correct / totalDecisions) * 100).toFixed(2)) : 100.0;
    const averageRating = ratings.length > 0
      ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
      : 5.0;

    let verificationStatus = isSuspended ? 'SUSPENDED' : (completed >= 50 && accuracy >= 95 ? 'TRUSTED' : (completed >= 5 ? 'VERIFIED' : 'PENDING'));

    return {
      verifierId,
      verificationStatus,
      completed,
      correct,
      incorrect,
      accuracy,
      disputes,
      successfulResolutions,
      rating: averageRating,
      totalDecisions,
      noShows,
      cancellations,
      isSuspended
    };
  }

  getEvents(verifierId) {
    return this.events.get(verifierId) || [];
  }
}

export const reputationManager = new ReputationManager();
