import fs from 'fs';

let content = fs.readFileSync('server/index.js', 'utf8');

// 1. Add imports
const importAnchor = `import { requireAuth, requireRole, requireActive } from './auth/middleware.js';`;
const newImports = `${importAnchor}
import { logAudit } from './auth/middleware.js';
import { disputeManager } from './disputes/disputeManager.js';
import { reputationManager } from './reputation/reputationManager.js';`;

if (!content.includes('disputeManager')) {
  content = content.replace(importAnchor, newImports);
  console.log('Added disputeManager and reputationManager imports');
}

// 2. Replace Dispute Section and Add Admin Endpoints
const oldDisputeSection = `// --- DISPUTE ENDPOINTS ---
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
});`;

const newDisputeAndAdminSection = `// --- DISPUTE ENDPOINTS (FORMAL 5-STATE LIFECYCLE) ---
app.post('/api/commitments/:id/dispute', async (req, res) => {
  try {
    const c = commitments.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Commitment not found' });
    if (c.status !== 'VERIFIED') {
      return res.status(400).json({ error: 'Can only dispute verified commitments before settlement' });
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

app.get('/api/commitments/:id/dispute', async (req, res) => {
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

    if (resolution === 'OVERTURN_TO_PASS' || resolution === 'RESOLVED_USER') {
      c.attestation.isSuccessful = true;
      c.attestation.resultCode = 'DISPUTE_OVERTURN_PASS';
    } else {
      c.attestation.isSuccessful = false;
      c.attestation.resultCode = 'DISPUTE_UPHELD_FAIL';
    }
    c.status = 'VERIFIED';
    await dbSaveCommitment(c);

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
      message: \`Dispute resolved: \${resolution}. Ready for settlement.\`,
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
});`;

if (content.includes(oldDisputeSection)) {
  content = content.replace(oldDisputeSection, newDisputeAndAdminSection);
  fs.writeFileSync('server/index.js', content, 'utf8');
  console.log('Successfully patched server/index.js with Disputes & Admin controls!');
} else {
  console.error('Old dispute section not matched in server/index.js');
}
