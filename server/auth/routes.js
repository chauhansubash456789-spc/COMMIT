import express from 'express';
import { supabaseAdmin, supabaseAnon } from './supabase.js';
import { requireAuth, requireActive, requireVerifiedEmail, requireRole, logAudit } from './middleware.js';
import { generateWalletChallenge, verifyWalletSignature, disconnectWallet, isValidSolanaAddress } from './walletAuth.js';

export const authRouter = express.Router();

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'system', 'official', 'commit',
  'moderator', 'support', 'root', 'security', 'verifier'
]);

// Email regex validator
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * POST /api/auth/signup
 */
authRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, confirmPassword, username, displayName } = req.body;

    // 1. Validation
    if (!email || !password || !username || !displayName) {
      return res.status(400).json({ error: 'All fields (email, password, username, displayName) are required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const cleanUsername = username.toLowerCase().trim();
    if (!USERNAME_REGEX.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores' });
    }

    if (RESERVED_USERNAMES.has(cleanUsername)) {
      return res.status(400).json({ error: 'This username is reserved and cannot be registered' });
    }

    // Check username uniqueness in user_profiles
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken. Please choose another username.' });
    }

    // 2. Create User authoritatively
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName.trim(),
        username: cleanUsername
      }
    });

    if (createError) {
      if (createError.message.toLowerCase().includes('already registered') || createError.message.toLowerCase().includes('unique')) {
        return res.status(400).json({ error: 'An account with this email address already exists' });
      }
      return res.status(400).json({ error: createError.message });
    }

    if (!newUserData || !newUserData.user) {
      return res.status(400).json({ error: 'Failed to create user account' });
    }

    // 3. Generate initial session
    const { data: sessionData } = await supabaseAnon.auth.signInWithPassword({
      email,
      password
    });

    // 4. Audit log
    await logAudit({
      actorUserId: newUserData.user.id,
      action: 'SIGNUP',
      targetType: 'USER',
      targetId: newUserData.user.id,
      metadata: { username: cleanUsername, email },
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Account created successfully!',
      user: {
        id: newUserData.user.id,
        email: newUserData.user.email,
        emailConfirmed: Boolean(newUserData.user.email_confirmed_at)
      },
      session: sessionData?.session || null
    });
  } catch (err) {
    console.error('[Signup Error]', err.message);
    res.status(500).json({ error: 'Internal signup error' });
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Authenticate with Supabase Auth
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user || !data.session) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch user profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();

    if (!profile || profileErr) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Enforce account status server-side
    if (profile.status === 'DISABLED') {
      // Invalidate session immediately
      await supabaseAdmin.auth.admin.signOut(data.session.access_token);
      return res.status(403).json({
        error: 'Account Disabled: Your account has been permanently disabled. Access denied.',
        status: 'DISABLED'
      });
    }

    // Fetch user stats
    const { data: stats } = await supabaseAdmin
      .from('user_stats')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();

    // Check if user is also registered as admin
    const { data: adminRecord } = await supabaseAdmin
      .from('admin_users')
      .select('admin_role, status')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (adminRecord && adminRecord.status === 'ACTIVE') {
      await supabaseAdmin
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', adminRecord.id);
    }

    await logAudit({
      actorUserId: data.user.id,
      action: 'LOGIN',
      targetType: 'SESSION',
      targetId: data.session.user.id,
      metadata: { role: profile.role, status: profile.status },
      ipAddress: req.ip
    });

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmed: Boolean(data.user.email_confirmed_at)
      },
      profile,
      stats: stats || {},
      isAdmin: profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN'
    });
  } catch (err) {
    console.error('[Login Error]', err.message);
    res.status(500).json({ error: 'Internal login error' });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', requireAuth, async (req, res) => {
  try {
    // Audit log
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
 * POST /api/auth/forgot-password
 * Never leaks whether email exists
 */
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (email && EMAIL_REGEX.test(email)) {
      await supabaseAnon.auth.resetPasswordForEmail(email, {
        redirectTo: `${req.protocol}://${req.get('host')}/reset-password`
      }).catch(() => {});

      await logAudit({
        actorUserId: null,
        action: 'PASSWORD_RESET',
        targetType: 'EMAIL',
        targetId: email,
        ipAddress: req.ip
      });
    }

    // Always return constant message to avoid email enumeration
    res.json({
      message: 'If an account exists for this email, a password reset link has been sent.'
    });
  } catch (err) {
    res.json({
      message: 'If an account exists for this email, a password reset link has been sent.'
    });
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
    const { verificationTypes } = req.body;

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', req.user.id)
      .single();

    const { data: verifier, error } = await supabaseAdmin
      .from('verifier_profiles')
      .upsert({
        user_id: profile.id,
        verification_status: 'PENDING',
        verification_level: 'NEW',
        verification_types: verificationTypes || ['peer_consensus'],
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

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

    res.json({ message: 'Verifier application submitted successfully', verifier });
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
    } else if (verificationStatus === 'REVOKED' || verificationStatus === 'SUSPENDED') {
      await supabaseAdmin
        .from('user_profiles')
        .update({ role: 'USER', updated_at: new Date().toISOString() })
        .eq('id', updated.user_id);
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