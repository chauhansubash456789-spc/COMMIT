import fs from 'fs';

let content = fs.readFileSync('server/index.js', 'utf8');

if (!content.includes('./auth/routes.js')) {
  const importTarget = "import { dbGetCommitments, dbSaveCommitment, isDatabaseReady } from './db/supabase.js';";
  const newImports = `import { dbGetCommitments, dbSaveCommitment, isDatabaseReady } from './db/supabase.js';
import { authRouter } from './auth/routes.js';
import { requireAuth, requireRole, requireActive } from './auth/middleware.js';
import { supabaseAdmin } from './auth/supabase.js';`;
  content = content.replace(importTarget, newImports);

  const mountTarget = "app.use(express.static(path.join(__dirname, '../public')));";
  const newMounts = `app.use(express.static(path.join(__dirname, '../public')));

// Mount Authentication & Admin Authorization Routes
app.use('/api/auth', authRouter);
app.use('/api', authRouter);`;
  content = content.replace(mountTarget, newMounts);

  const createTarget = "  // Title validation";
  const createCheck = `  // Authenticated account status check (blocks suspended / disabled users)
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

  // Title validation`;
  content = content.replace(createTarget, createCheck);

  content = content.replace(
    "app.post('/api/commitments/:id/resolve-dispute', async (req, res) => {",
    "app.post('/api/commitments/:id/resolve-dispute', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {"
  );

  fs.writeFileSync('server/index.js', content, 'utf8');
  console.log('Successfully patched server/index.js');
} else {
  console.log('server/index.js already contains auth imports');
}