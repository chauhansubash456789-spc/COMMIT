import express from 'express';
import { supabaseAdmin, supabaseAnon } from './supabase.js';
import { requireAuth, requireActive, requireVerifiedEmail, requireRole, logAudit } from './middleware.js';
import {
  generateWalletChallenge,
  verifyWalletSignature,
  disconnectWallet,
  isValidSolanaAddress,
  generateWalletAuthChallenge,
  authenticateWalletSignature
} from './walletAuth.js';
import { verifierManager } from '../verifiers/verifierManager.js';

export const authRouter = express.Router();

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'system', 'official', 'commit',
  'moderator', 'support', 'root', 'security', 'verifier'
]);

// Username regex validator
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

// =============================================================================
// PRIMARY WALLET AUTHENTICATION ROUTES (SIWS COMPLIANT)
// =============================================================================

/**
 * POST /api/auth/wallet/challenge
 * Issues an authoritative, single-use, anti-replay SIWS cryptographic challenge
 */
authRouter.post('/wallet/challenge', async (req, res) => {
  try {
    const { walletAddress, domain, origin } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }
    const requestedTarget = origin || domain || req.headers.origin || null;
    const challenge = await generateWalletAuthChallenge(walletAddress, requestedTarget, req.ip);
    res.json(challenge);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/auth/wallet/authenticate (also aliased at /api/auth/wallet/login)
 * Primary Authentication Method:
 * Verifies Ed25519 wallet signature, enforces single-use challenge & 5-minute expiry,
 * provisions or loads user profile, and returns authenticated Supabase session JWT.
 */
async function handleWalletAuthenticate(req, res) {
  try {
    const { walletAddress, nonce, signature, origin, domain } = req.body;
    const expectedOrigin = origin || domain || req.headers.origin || null;
    const result = await authenticateWalletSignature({
      walletAddress,
      nonce,
      signature,
      expectedOrigin,
      ipAddress: req.ip
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

authRouter.post('/wallet/authenticate', handleWalletAuthenticate);
authRouter.post('/wallet/login', handleWalletAuthenticate);

// =============================================================================
// RETIRED TRADITIONAL EMAIL/PASSWORD AUTHENTICATION ROUTES
// =============================================================================

/**
 * POST /api/auth/signup - RETIRED
 */
authRouter.post('/signup', (req, res) => {
  res.status(410).json({
    error: 'Traditional email/password signup is retired. Please authenticate via Solana Connect Wallet (/api/auth/wallet/challenge & /api/auth/wallet/authenticate).',
    code: 'WALLET_AUTH_REQUIRED'
  });
});

/**
 * POST /api/auth/login - RETIRED
 */
authRouter.post('/login', (req, res) => {
  res.status(410).json({
    error: 'Traditional email/password login is retired. Please authenticate via Solana Connect Wallet (/api/auth/wallet/challenge & /api/auth/wallet/authenticate).',
    code: 'WALLET_AUTH_REQUIRED'
  });
});

/**
 * POST /api/auth/forgot-password - RETIRED
 */
authRouter.post('/forgot-password', (req, res) => {
  res.status(410).json({
    error: 'Password reset is retired. Authentication is handled exclusively via cryptographic Solana wallet signatures.',
    code: 'WALLET_AUTH_REQUIRED'
  });
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', requireAuth, async (req, res) => {
  try {
    await logAudit({
      actorUserId: req.user.id,
      action: 'LOGOUT',
      targetType: 'SESSION',
      targetId: req.user.id,
      ipAddress: req.ip
    });
    res.json({ message: 'Successfully logged out and session cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Logout error' });
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', req.user.id)
      .single();

    const { data: stats } = await supabaseAdmin
      .from('user_stats')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();

    const { data: verifier } = await supabaseAdmin
      .from('verifier_profiles')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        emailConfirmed: Boolean(req.user.email_confirmed_at)
      },
      profile,
      stats: stats || {},
      verifierProfile: verifier || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

/**
 * PUT /api/auth/profile
 * Allows updating safe fields ONLY (rejects role, status, wallet_address, stats tampering)
 */
authRouter.put('/profile', requireAuth, requireActive, async (req, res) => {
  try {
    const { displayName, bio, avatarUrl, role, status, walletAddress, success_rate } = req.body;

    // Defense-in-depth: Reject any malicious attempts to elevate role or status
    if (role !== undefined || status !== undefined) {
      return res.status(403).json({
        error: 'Privilege Escalation Rejected: Role and Status can only be changed by administrators.'
      });
    }

    if (walletAddress !== undefined) {
      return res.status(400).json({
        error: 'Direct Wallet Modification Rejected: Wallets must be attached via signed cryptographic challenge.'
      });
    }

    if (success_rate !== undefined) {
      return res.status(403).json({
        error: 'Stats Modification Rejected: Statistics are authoritatively calculated from commitments.'
      });
    }

    const updates = {};
    if (displayName !== undefined) {
      if (displayName.trim().length < 2 || displayName.trim().length > 50) {
        return res.status(400).json({ error: 'Display name must be between 2 and 50 characters' });
      }
      updates.display_name = displayName.trim();
    }

    if (bio !== undefined) {
      if (bio.length > 500) {
        return res.status(400).json({ error: 'Bio must be at most 500 characters' });
      }
      updates.bio = bio.trim();
    }

    if (avatarUrl !== undefined) {
      updates.avatar_url = avatarUrl ? String(avatarUrl).trim() : null;
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('auth_user_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAudit({
      actorUserId: req.user.id,
      action: 'PROFILE_UPDATED',
      targetType: 'USER_PROFILE',
      targetId: updatedProfile.id,
      metadata: { fields: Object.keys(updates) },
      ipAddress: req.ip
    });

    res.json({ message: 'Profile updated successfully', profile: updatedProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/wallet/nonce
 */
authRouter.post('/wallet/nonce', requireAuth, requireActive, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const challenge = await generateWalletChallenge(req.user.id, walletAddress, req.ip);
    res.json(challenge);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/auth/wallet/verify
 */
authRouter.post('/wallet/verify', requireAuth, requireActive, async (req, res) => {
  try {
    const { walletAddress, nonce, signature } = req.body;
    const result = await verifyWalletSignature({
      userId: req.user.id,
      walletAddress,
      nonce,
      signature,
      ipAddress: req.ip
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/auth/wallet/disconnect
 */
authRouter.post('/wallet/disconnect', requireAuth, requireActive, async (req, res) => {
  try {
    const result = await disconnectWallet(req.user.id, req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/verifier/apply
 */
authRouter.post('/verifier/apply', requireAuth, requireActive, requireVerifiedEmail, async (req, res) => {
  try {
    const {
      displayName,
      bio,
      specializations,
      serviceArea,
      verificationType,
      verificationTypes,
      availability,
      profileImage
    } = req.body;

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', req.user.id)
      .single();

    // Client CANNOT submit role = VERIFIER, status = TRUSTED, accuracy = 100
    // These are strictly server-controlled:
    const dbPayload = {
      user_id: profile.id,
      verification_status: 'PENDING',
      verification_level: 'NEW',
      verification_types: verificationTypes || (specializations || ['peer_consensus', 'human_physical']),
      updated_at: new Date().toISOString()
    };

    const { data: verifier, error } = await supabaseAdmin
      .from('verifier_profiles')
      .upsert(dbPayload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (bio) {
      await supabaseAdmin.from('user_profiles').update({ bio }).eq('id', profile.id);
    }

    // Update in-memory verifier manager state with full extended metadata
    const verifierId = verifier.id;
    const verifierObj = {
      id: verifierId,
      userId: profile.id,
      displayName: displayName || profile.display_name,
      bio: (bio || profile.bio || '').slice(0, 500),
      specializations: dbPayload.verification_types,
      serviceArea: (serviceArea || 'Remote').slice(0, 100),
      verificationType: verificationType || 'human_physical',
      status: 'PENDING',
      level: 'NEW',
      availability: availability || 'Available',
      wallet: profile.wallet_address || 'UNLINKED',
      profileImage: profileImage || profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
      createdAt: verifier.created_at || new Date().toISOString()
    };
    verifierManager.verifiers.set(verifierId, verifierObj);
    verifierManager.verifiers.set(profile.id, verifierObj);

    // Init verifier stats if not existing
    await supabaseAdmin
      .from('verifier_stats')
      .upsert({ verifier_id: verifier.id }, { onConflict: 'verifier_id' });

    await logAudit({
      actorUserId: req.user.id,
      action: 'VERIFIER_APPLIED',
      targetType: 'VERIFIER_PROFILE',
      targetId: verifier.id,
      ipAddress: req.ip
    });

    res.json({ message: 'Verifier application submitted successfully', verifier: verifierObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// ADMIN AUTHORIZATION ROUTES
// =============================================================================

/**
 * GET /api/admin/users
 */
authRouter.get('/admin/users', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, auth_user_id, username, display_name, wallet_address, role, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users/:id/status
 */
authRouter.post('/admin/users/:id/status', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { status, reason } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Support both profile.id and profile.auth_user_id
    const { data: updated, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .or(`id.eq.${targetUserId},auth_user_id.eq.${targetUserId}`)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ error: 'Target user profile not found' });
    }

    await logAudit({
      actorUserId: req.user.id,
      action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'ADMIN_STATUS_CHANGED',
      targetType: 'USER_PROFILE',
      targetId: targetUserId,
      metadata: { newStatus: status, reason: reason || 'Admin operation' },
      ipAddress: req.ip
    });

    res.json({ message: `User status updated to ${status}`, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/verifiers/:id/status
 */
authRouter.post('/admin/verifiers/:id/status', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const verifierId = req.params.id;
    const { verificationStatus, verificationLevel, reason } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (verificationStatus) updates.verification_status = verificationStatus;
    if (verificationLevel) updates.verification_level = verificationLevel;

    const { data: updated, error } = await supabaseAdmin
      .from('verifier_profiles')
      .update(updates)
      .eq('id', verifierId)
      .select()
      .single();

    if (error || !updated) {
      return res.status(404).json({ error: 'Verifier profile not found' });
    }

    // If verified, update the user profile's role to VERIFIER
    if (verificationStatus === 'VERIFIED') {
      await supabaseAdmin
        .from('user_profiles')
        .update({ role: 'VERIFIER', updated_at: new Date().toISOString() })
        .eq('id', updated.user_id);
      await verifierManager.approveVerifier(updated.id, req.user.id).catch(() => {});
    } else if (verificationStatus === 'REVOKED' || verificationStatus === 'SUSPENDED') {
      await supabaseAdmin
        .from('user_profiles')
        .update({ role: 'USER', updated_at: new Date().toISOString() })
        .eq('id', updated.user_id);
      await verifierManager.suspendVerifier(updated.id, req.user.id, reason).catch(() => {});
    }

    await logAudit({
      actorUserId: req.user.id,
      action: verificationStatus === 'VERIFIED' ? 'ADMIN_APPROVED_VERIFIER' : 'ADMIN_SUSPENDED_VERIFIER',
      targetType: 'VERIFIER_PROFILE',
      targetId: verifierId,
      metadata: { updates, reason: reason || 'Admin verifier status review' },
      ipAddress: req.ip
    });

    res.json({ message: 'Verifier status updated', verifier: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/audit-logs
 */
authRouter.get('/admin/audit-logs', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const { data: logs, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ auditLogs: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});