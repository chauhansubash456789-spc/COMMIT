import { supabaseAdmin } from './supabase.js';

/**
 * Middleware: Enforces valid Supabase Auth JWT and loads profile
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid, expired, or revoked session token' });
    }

    // Load user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found for authenticated account' });
    }

    req.user = user;
    req.profile = profile;
    req.token = token;
    next();
  } catch (err) {
    console.error('[requireAuth Error]', err.message);
    res.status(500).json({ error: 'Internal server authentication error' });
  }
}

/**
 * Middleware: Enforces that user account is ACTIVE (blocks SUSPENDED and DISABLED)
 */
export function requireActive(req, res, next) {
  if (!req.profile) {
    return res.status(401).json({ error: 'Unauthorized: Profile not loaded' });
  }

  if (req.profile.status === 'SUSPENDED') {
    return res.status(403).json({
      error: 'Account Suspended: Your account is suspended. Restricted actions are blocked.',
      accountStatus: 'SUSPENDED'
    });
  }

  if (req.profile.status === 'DISABLED') {
    return res.status(403).json({
      error: 'Account Disabled: Your account has been disabled by administration.',
      accountStatus: 'DISABLED'
    });
  }

  next();
}

/**
 * Middleware: Enforces email verification for sensitive operations
 */
export function requireVerifiedEmail(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const isVerified = Boolean(req.user.email_confirmed_at);
  if (!isVerified) {
    return res.status(403).json({
      error: 'Email Verification Required: Please verify your email address to access this feature.',
      requiresEmailVerification: true
    });
  }

  next();
}

/**
 * Middleware: Role-Based Access Control (RBAC)
 * @param {string[]} allowedRoles Array of acceptable roles (e.g. ['ADMIN', 'SUPER_ADMIN'])
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Unauthorized: Profile not loaded' });
    }

    if (!allowedRoles.includes(req.profile.role)) {
      return res.status(403).json({
        error: `Forbidden: Action requires one of [${allowedRoles.join(', ')}]. Current role: '${req.profile.role}'.`
      });
    }

    next();
  };
}

/**
 * Authoritative Audit Logger
 * Never writes passwords, private keys, or credentials
 */
export async function logAudit({
  actorUserId = null,
  action,
  targetType,
  targetId,
  metadata = {},
  ipAddress = null
}) {
  try {
    // Sanitization: strip any sensitive fields
    const safeMetadata = { ...metadata };
    delete safeMetadata.password;
    delete safeMetadata.secretKey;
    delete safeMetadata.privateKey;
    delete safeMetadata.token;
    delete safeMetadata.seedPhrase;

    await supabaseAdmin.from('audit_logs').insert({
      actor_user_id: actorUserId,
      action,
      target_type: targetType,
      target_id: String(targetId),
      metadata: safeMetadata,
      ip_address: ipAddress
    });
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
}