import fs from 'fs';

console.log('--- EXTRACTING ALL INLINE STYLES FROM index.html INTO style.css ---');

let html = fs.readFileSync('public/index.html', 'utf8');
let css = fs.readFileSync('public/css/style.css', 'utf8');

const cssRulesToAdd = `
/* ==========================================================================
   EXTRACTED INDEX.HTML COMPONENT STYLES & UTILITIES
   ========================================================================== */

/* Header & Meta */
.wallet-separator {
  color: var(--border-subtle);
}

.wallet-balance-purple {
  color: var(--sol-purple);
}

.btn-airdrop {
  padding: 0.2rem 0.6rem;
  font-size: 0.7rem;
  margin-left: 0.25rem;
}

.auth-header-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-open-auth {
  border-color: rgba(0, 240, 255, 0.4);
  color: var(--sol-cyan);
}

/* Nav Badges */
.badge-pill-emerald {
  background: rgba(20, 241, 149, 0.2);
  color: var(--sol-emerald);
}

.badge-pill-cyan {
  background: rgba(0, 240, 255, 0.2);
  color: var(--sol-cyan);
}

.badge-pill-amber {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.badge-pill-ready {
  font-size: 0.65rem;
  background: rgba(20, 241, 149, 0.15);
  color: var(--sol-emerald);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.hidden {
  display: none !important;
}

/* Dashboard */
.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title-sm {
  font-size: 1.25rem;
  font-weight: 700;
}

/* Wizard */
.wizard-auth-card {
  text-align: center;
  padding: 3.5rem 1.5rem;
}

.wizard-lock-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.wizard-auth-title {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.wizard-auth-desc {
  color: var(--text-muted);
  max-width: 440px;
  margin: 0 auto 1.5rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.btn-auth-lock-action {
  padding: 0.75rem 2rem;
  font-weight: 700;
  font-size: 0.95rem;
}

.form-grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-grid-2col-spaced {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.input-dimmed {
  opacity: 0.7;
}

.wizard-preview-box {
  margin: 1.5rem 0;
}

.wizard-preview-card {
  padding: 1rem;
}

/* Deep Work Focus Studio */
.tab-header-box {
  margin-bottom: 1.5rem;
}

.tab-main-title {
  font-size: 1.6rem;
  font-weight: 800;
}

.tab-subtitle {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.timer-btn-row {
  display: flex;
  gap: 1rem;
  width: 100%;
  max-width: 380px;
}

.feed-title {
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
}

.info-callout-card {
  margin-top: 1.5rem;
  background: var(--bg-glass-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 1.25rem;
}

.callout-title {
  font-size: 0.85rem;
  color: var(--sol-emerald);
  margin-bottom: 0.5rem;
}

.callout-body {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.4;
}

/* Verifier Studios */
.verifier-card-container {
  background: var(--bg-glass-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.consequence-box-spaced {
  margin-bottom: 1.5rem;
}

/* Peer Portal */
.peer-portal-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.5rem;
}

.peer-profile-panel {
  background: var(--bg-glass-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
}

.peer-avatar-center {
  text-align: center;
  margin-bottom: 1.25rem;
}

.peer-avatar-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--gradient-cyber);
  margin: 0 auto 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.peer-name {
  font-size: 1.15rem;
  font-weight: 700;
}

.peer-rating {
  color: var(--sol-amber);
  font-size: 0.85rem;
}

.badge-expert {
  background: rgba(20, 241, 149, 0.15);
  color: var(--sol-emerald);
  margin-top: 0.5rem;
  display: inline-block;
}

.peer-stats-list {
  border-top: 1px solid var(--border-subtle);
  padding-top: 1rem;
  font-size: 0.82rem;
}

.peer-stat-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.peer-stat-row-last {
  display: flex;
  justify-content: space-between;
}

.text-muted {
  color: var(--text-muted);
}

.text-emerald-bold {
  font-weight: 700;
  color: var(--sol-emerald);
}

.text-bold {
  font-weight: 700;
}

.text-cyan-bold {
  font-weight: 700;
  color: var(--sol-cyan);
}

.challenge-code-panel {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin-bottom: 1.25rem;
}

[data-theme="light"] .challenge-code-panel {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.challenge-code-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.challenge-code-label {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.challenge-code-val {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--sol-cyan);
}

.challenge-code-desc {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.task-checklist-panel {
  margin-bottom: 1.25rem;
}

.task-checklist-title {
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.task-checklist-items {
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.form-select-group {
  margin-bottom: 1rem;
}

.form-label-sm {
  font-size: 0.8rem;
}

.form-select-sm {
  padding: 0.5rem;
}

.btn-row-gap {
  display: flex;
  gap: 1rem;
}

/* Blinks */
.twitter-tweet-text {
  color: #fff;
  margin-top: 0.25rem;
}

[data-theme="light"] .twitter-tweet-text {
  color: #0f172a;
}

.blink-banner-custom {
  background: var(--gradient-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sol-purple);
  font-size: 2.5rem;
  font-weight: 900;
}

.card-title-spaced {
  margin-top: 0.75rem;
}

.demo-card-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

/* Admin Panel */
.admin-panel-padded {
  padding: 1.75rem;
}

.admin-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.admin-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
}

[data-theme="light"] .admin-title {
  color: #0f172a;
}

.admin-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.admin-table-scroll {
  overflow-x: auto;
}

.table-empty-cell {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem;
}

/* Modals & Demo Accounts */
.modal-title-cyan {
  color: var(--sol-cyan);
}

.modal-title-purple {
  color: var(--sol-purple);
}

.modal-close-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
}

.demo-accounts-box {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(0, 240, 255, 0.04);
  border: 1px dashed rgba(0, 240, 255, 0.25);
  border-radius: 8px;
}

.demo-box-header {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.demo-box-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.demo-grid-4col {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.35rem;
}

.btn-demo-alice {
  font-size: 0.7rem;
  padding: 0.4rem 0.15rem;
  text-align: center;
  border-color: rgba(0, 240, 255, 0.3);
  line-height: 1.2;
}

.btn-demo-bob {
  font-size: 0.7rem;
  padding: 0.4rem 0.15rem;
  text-align: center;
  border-color: rgba(20, 241, 149, 0.3);
  line-height: 1.2;
}

.btn-demo-charlie {
  font-size: 0.7rem;
  padding: 0.4rem 0.15rem;
  text-align: center;
  border-color: rgba(153, 69, 255, 0.3);
  line-height: 1.2;
}

.btn-demo-david {
  font-size: 0.7rem;
  padding: 0.4rem 0.15rem;
  text-align: center;
  border-color: rgba(255, 184, 0, 0.3);
  line-height: 1.2;
}

.demo-sublabel {
  font-size: 0.62rem;
  color: var(--text-muted);
}

.btn-auth-submit {
  width: 100%;
  margin-top: 0.5rem;
}

.wallet-challenge-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.btn-w-full {
  width: 100%;
}
`;

// Append CSS rules to style.css if not already present
if (!css.includes('EXTRACTED INDEX.HTML COMPONENT STYLES')) {
  css += '\n' + cssRulesToAdd;
  fs.writeFileSync('public/css/style.css', css, 'utf8');
  console.log('✅ Added extracted CSS classes to public/css/style.css');
} else {
  console.log('ℹ️ Extracted CSS classes already in public/css/style.css');
}

// Map each inline style in index.html to clean classes
const replacements = [
  // Header & Meta
  { from: '<span style="color:var(--border-subtle)">|</span>', to: '<span class="wallet-separator">|</span>' },
  { from: '<span class="wallet-balance" style="color:var(--sol-purple)" id="walletSol">', to: '<span class="wallet-balance wallet-balance-purple" id="walletSol">' },
  { from: '<button class="btn btn-primary btn-sm" style="padding:0.2rem 0.6rem;font-size:0.7rem;margin-left:0.25rem;">+ Airdrop</button>', to: '<button class="btn btn-primary btn-sm btn-airdrop">+ Airdrop</button>' },
  { from: '<div id="authHeaderSection" style="display:flex;align-items:center;gap:0.5rem;">', to: '<div id="authHeaderSection" class="auth-header-section">' },
  { from: '<button class="btn btn-outline btn-sm" id="btnOpenAuth" onclick="openAuthModal(\'signin\')" style="border-color:rgba(0,240,255,0.4);color:var(--sol-cyan);">', to: '<button class="btn btn-outline btn-sm btn-open-auth" id="btnOpenAuth" onclick="openAuthModal(\'signin\')">' },

  // Nav badges
  { from: '<span class="badge-pill" style="background:rgba(20,241,149,0.2);color:var(--sol-emerald)">Live Heartbeats</span>', to: '<span class="badge-pill badge-pill-emerald">Live Heartbeats</span>' },
  { from: '<span class="badge-pill" style="background:rgba(0,240,255,0.2);color:var(--sol-cyan)">Blockhash</span>', to: '<span class="badge-pill badge-pill-cyan">Blockhash</span>' },
  { from: '<button class="nav-tab-btn" data-tab="tab-admin" id="navTabAdmin" style="display:none;">', to: '<button class="nav-tab-btn hidden" data-tab="tab-admin" id="navTabAdmin">' },
  { from: '<span class="badge-pill" style="background:rgba(245,158,11,0.2);color:#fbbf24">RLS</span>', to: '<span class="badge-pill badge-pill-amber">RLS</span>' },

  // Dashboard
  { from: '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">', to: '<div class="section-header-row">' },
  { from: '<h3 style="font-size:1.25rem;font-weight:700;">Active Commitments & Escrows</h3>', to: '<h3 class="section-title-sm">Active Commitments & Escrows</h3>' },

  // Wizard
  { from: '<div id="wizardAuthRequiredCard" class="wizard-card" style="text-align:center;padding:3.5rem 1.5rem;">', to: '<div id="wizardAuthRequiredCard" class="wizard-card wizard-auth-card">' },
  { from: '<div style="font-size:3rem;margin-bottom:1rem;">dY"\'</div>', to: '<div class="wizard-lock-icon">🔒</div>' },
  { from: '<div style="font-size:3rem;margin-bottom:1rem;">🔒</div>', to: '<div class="wizard-lock-icon">🔒</div>' },
  { from: '<h3 style="font-size:1.4rem;font-weight:700;margin-bottom:0.5rem;">Authentication Required</h3>', to: '<h3 class="wizard-auth-title">Authentication Required</h3>' },
  { from: '<p style="color:var(--text-muted);max-width:440px;margin:0 auto 1.5rem;font-size:0.95rem;line-height:1.5;">', to: '<p class="wizard-auth-desc">' },
  { from: '<button class="btn btn-primary" onclick="openAuthModal(\'signin\')" style="padding:0.75rem 2rem;font-weight:700;font-size:0.95rem;">', to: '<button class="btn btn-primary btn-auth-lock-action" onclick="openAuthModal(\'signin\')">' },
  { from: '<div id="wizardFormCard" class="wizard-card" style="display:none;">', to: '<div id="wizardFormCard" class="wizard-card hidden">' },
  { from: '<div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">', to: '<div class="form-group form-grid-2col">' },
  { from: '<input type="text" class="form-input" value="1.50 USDC" disabled style="opacity:0.7">', to: '<input type="text" class="form-input input-dimmed" value="1.50 USDC" disabled>' },
  { from: '<div style="margin:1.5rem 0;">', to: '<div class="wizard-preview-box">' },
  { from: '<div class="consequence-box" id="wizardConsequencePreview" style="padding:1rem;">', to: '<div class="consequence-box wizard-preview-card" id="wizardConsequencePreview">' },

  // Deep Work Focus Studio
  { from: '<div style="margin-bottom:1.5rem;">\n        <h2 style="font-size:1.6rem;font-weight:800;">Deep Work & Focus Terminal</h2>\n        <p style="color:var(--text-muted);font-size:0.9rem;">', to: '<div class="tab-header-box">\n        <h2 class="tab-main-title">Deep Work & Focus Terminal</h2>\n        <p class="tab-subtitle">' },
  { from: '<div style="display:flex;gap:1rem;width:100%;max-width:380px;">', to: '<div class="timer-btn-row">' },
  { from: '<h4 style="font-size:0.95rem;margin-bottom:0.75rem;">Cryptographic Nonce & Heartbeat Feed</h4>', to: '<h4 class="feed-title">Cryptographic Nonce & Heartbeat Feed</h4>' },
  { from: '<div style="margin-top:1.5rem;background:var(--bg-glass-card);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1.25rem;">', to: '<div class="info-callout-card">' },
  { from: '<h5 style="font-size:0.85rem;color:var(--sol-emerald);margin-bottom:0.5rem;">Anti-Cheating Architecture</h5>', to: '<h5 class="callout-title">Anti-Cheating Architecture</h5>' },
  { from: '<p style="font-size:0.78rem;color:var(--text-muted);line-height:1.4;">', to: '<p class="callout-body">' },

  // GitHub Verifier Studio
  { from: '<div style="margin-bottom:1.5rem;">\n        <h2 style="font-size:1.6rem;font-weight:800;">Automated GitHub Commitment Verifier</h2>\n        <p style="color:var(--text-muted);font-size:0.9rem;">', to: '<div class="tab-header-box">\n        <h2 class="tab-main-title">Automated GitHub Commitment Verifier</h2>\n        <p class="tab-subtitle">' },
  { from: '<div style="background:var(--bg-glass-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:2rem;max-width:800px;margin:0 auto;">', to: '<div class="verifier-card-container">' },
  { from: '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">', to: '<div class="form-grid-2col-spaced">' },
  { from: '<input type="text" class="form-input" value="Last 7 Days (Oct 1 - Oct 8)" disabled style="opacity:0.7">', to: '<input type="text" class="form-input input-dimmed" value="Last 7 Days (Oct 1 - Oct 8)" disabled>' },
  { from: '<div class="consequence-box" style="margin-bottom:1.5rem;">', to: '<div class="consequence-box consequence-box-spaced">' },

  // Peer Verifier Portal
  { from: '<div style="margin-bottom:1.5rem;">\n        <h2 style="font-size:1.6rem;font-weight:800;">Decentralized Remote Peer Verifier Portal</h2>\n        <p style="color:var(--text-muted);font-size:0.9rem;">', to: '<div class="tab-header-box">\n        <h2 class="tab-main-title">Decentralized Remote Peer Verifier Portal</h2>\n        <p class="tab-subtitle">' },
  { from: '<div style="display:grid;grid-template-columns:320px 1fr;gap:1.5rem;">', to: '<div class="peer-portal-layout">' },
  { from: '<div style="background:var(--bg-glass-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:1.5rem;">', to: '<div class="peer-profile-panel">' },
  { from: '<div style="text-align:center;margin-bottom:1.25rem;">', to: '<div class="peer-avatar-center">' },
  { from: '<div style="width:64px;height:64px;border-radius:50%;background:var(--gradient-cyber);margin:0 auto 0.75rem;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">dY`"??dY\'</div>', to: '<div class="peer-avatar-circle">🛡️</div>' },
  { from: '<div style="width:64px;height:64px;border-radius:50%;background:var(--gradient-cyber);margin:0 auto 0.75rem;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🛡️</div>', to: '<div class="peer-avatar-circle">🛡️</div>' },
  { from: '<h3 style="font-size:1.15rem;font-weight:700;">Alex M.</h3>', to: '<h3 class="peer-name">Alex M.</h3>' },
  { from: '<h3 style="font-size:1.15rem;font-weight:700;">Active Verification Task: Electronics Lab Organization</h3>', to: '<h3 class="peer-name">Active Verification Task: Electronics Lab Organization</h3>' },
  { from: '<div style="color:var(--sol-amber);font-size:0.85rem;">', to: '<div class="peer-rating">' },
  { from: '<span class="badge-pill" style="background:rgba(20,241,149,0.15);color:var(--sol-emerald);margin-top:0.5rem;display:inline-block;">Verified Expert</span>', to: '<span class="badge-pill badge-expert">Verified Expert</span>' },
  { from: '<div style="border-top:1px solid var(--border-subtle);padding-top:1rem;font-size:0.82rem;">', to: '<div class="peer-stats-list">' },
  { from: '<div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">', to: '<div class="peer-stat-row">' },
  { from: '<div style="display:flex;justify-content:space-between;">', to: '<div class="peer-stat-row-last">' },
  { from: '<span style="color:var(--text-muted)">Accuracy:</span>', to: '<span class="text-muted">Accuracy:</span>' },
  { from: '<span style="font-weight:700;color:var(--sol-emerald)">96%</span>', to: '<span class="text-emerald-bold">96%</span>' },
  { from: '<span style="color:var(--text-muted)">Completed:</span>', to: '<span class="text-muted">Completed:</span>' },
  { from: '<span style="font-weight:700;">128 Tasks</span>', to: '<span class="text-bold">128 Tasks</span>' },
  { from: '<span style="color:var(--text-muted)">Dispute Rate:</span>', to: '<span class="text-muted">Dispute Rate:</span>' },
  { from: '<span style="font-weight:700;color:var(--sol-cyan)">1.8%</span>', to: '<span class="text-cyan-bold">1.8%</span>' },
  { from: '<span style="color:var(--text-muted)">Total Earned:</span>', to: '<span class="text-muted">Total Earned:</span>' },
  { from: '<span style="font-weight:700;color:var(--sol-emerald)">84.50 USDC</span>', to: '<span class="text-emerald-bold">84.50 USDC</span>' },
  { from: '<div style="background:rgba(0,0,0,0.4);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;margin-bottom:1.25rem;">', to: '<div class="challenge-code-panel">' },
  { from: '<span style="color:var(--text-muted);font-size:0.8rem;">Dynamic Blockhash Challenge:</span>', to: '<span class="challenge-code-label">Dynamic Blockhash Challenge:</span>' },
  { from: '<span style="font-family:var(--font-mono);font-weight:700;color:var(--sol-cyan)" id="peerChallengeCode">', to: '<span class="challenge-code-val" id="peerChallengeCode">' },
  { from: '<p style="font-size:0.8rem;color:var(--text-muted);">', to: '<p class="challenge-code-desc">' },
  { from: '<div style="margin-bottom:1.25rem;">', to: '<div class="task-checklist-panel">' },
  { from: '<h5 style="font-size:0.85rem;margin-bottom:0.5rem;">Task Checklist & Requirements:</h5>', to: '<h5 class="task-checklist-title">Task Checklist & Requirements:</h5>' },
  { from: '<div style="font-size:0.82rem;color:var(--text-muted);line-height:1.6;">', to: '<div class="task-checklist-items">' },
  { from: '<div style="margin-bottom:1rem;">', to: '<div class="form-select-group">' },
  { from: '<label class="form-label" style="font-size:0.8rem;">Select Reviewing Verifier Key:</label>', to: '<label class="form-label form-label-sm">Select Reviewing Verifier Key:</label>' },
  { from: '<select id="peerVerifierSelect" class="form-select" style="padding:0.5rem;">', to: '<select id="peerVerifierSelect" class="form-select form-select-sm">' },
  { from: '<div style="display:flex;gap:1rem;">', to: '<div class="btn-row-gap">' },

  // Blinks & Demos
  { from: '<div style="margin-bottom:1.5rem;">\n        <h2 style="font-size:1.6rem;font-weight:800;">Solana Blinks (Actions) Social Integration</h2>\n        <p style="color:var(--text-muted);font-size:0.9rem;">', to: '<div class="tab-header-box">\n        <h2 class="tab-main-title">Solana Blinks (Actions) Social Integration</h2>\n        <p class="tab-subtitle">' },
  { from: '<div style="color:#fff;margin-top:0.25rem;">', to: '<div class="twitter-tweet-text">' },
  { from: '<div class="blink-banner-img" style="background:var(--gradient-dark);display:flex;align-items:center;justify-content:center;color:var(--sol-purple);font-size:2.5rem;font-weight:900;">', to: '<div class="blink-banner-img blink-banner-custom">' },
  { from: '<div style="margin-bottom:1.5rem;">\n        <h2 style="font-size:1.6rem;font-weight:800;">Colosseum Hackathon 1-Click Demos</h2>\n        <p style="color:var(--text-muted);font-size:0.9rem;">', to: '<div class="tab-header-box">\n        <h2 class="tab-main-title">Colosseum Hackathon 1-Click Demos</h2>\n        <p class="tab-subtitle">' },
  { from: '<h3 class="card-title" style="margin-top:0.75rem;">', to: '<h3 class="card-title card-title-spaced">' },
  { from: '<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1rem;">', to: '<p class="demo-card-desc">' },

  // Admin
  { from: '<div class="glass-panel" style="padding:1.75rem;">', to: '<div class="glass-panel admin-panel-padded">' },
  { from: '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">', to: '<div class="admin-header-row">' },
  { from: '<h2 style="font-size:1.4rem;font-weight:700;color:#fff;">', to: '<h2 class="admin-title">' },
  { from: '<p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.25rem;">', to: '<p class="admin-subtitle">' },
  { from: '<div style="overflow-x:auto;">', to: '<div class="admin-table-scroll">' },
  { from: '<td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">', to: '<td colspan="6" class="table-empty-cell">' },

  // Modals & 1-Click Demo Accounts
  { from: '<span style="color:var(--sol-cyan)">s</span> Commit Supabase Auth', to: '<span class="modal-title-cyan">⚡</span> Commit Supabase Auth' },
  { from: '<span style="color:var(--sol-cyan)">⚡</span> Commit Supabase Auth', to: '<span class="modal-title-cyan">⚡</span> Commit Supabase Auth' },
  { from: '<button class="close-btn" onclick="closeAuthModal()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;">&times;</button>', to: '<button class="close-btn modal-close-icon" onclick="closeAuthModal()">&times;</button>' },
  { from: '<div class="demo-accounts-box" style="margin-bottom:1rem;padding:0.75rem;background:rgba(0,240,255,0.04);border:1px dashed rgba(0,240,255,0.25);border-radius:8px;">', to: '<div class="demo-accounts-box">' },
  { from: '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;">', to: '<div class="demo-box-header">' },
  { from: '<span style="display:flex;align-items:center;gap:0.35rem;">', to: '<span class="demo-box-title">' },
  { from: '<span class="badge-pill" style="font-size:0.65rem;background:rgba(20,241,149,0.15);color:var(--sol-emerald);padding:0.15rem 0.4rem;border-radius:4px;">Ready</span>', to: '<span class="badge-pill badge-pill-ready">Ready</span>' },
  { from: '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:0.35rem;">', to: '<div class="demo-grid-4col">' },
  { from: '<button type="button" class="btn btn-outline btn-sm" onclick="fillDemoLogin(\'alice@commit.fun\', \'Demo1234!\')" style="font-size:0.7rem;padding:0.4rem 0.15rem;text-align:center;border-color:rgba(0,240,255,0.3);line-height:1.2;" title="Alice: Goal Creator / Staker">', to: '<button type="button" class="btn btn-outline btn-sm btn-demo-alice" onclick="fillDemoLogin(\'alice@commit.fun\', \'Demo1234!\')" title="Alice: Goal Creator / Staker">' },
  { from: '<button type="button" class="btn btn-outline btn-sm" onclick="fillDemoLogin(\'bob@commit.fun\', \'Demo1234!\')" style="font-size:0.7rem;padding:0.4rem 0.15rem;text-align:center;border-color:rgba(20,241,149,0.3);line-height:1.2;" title="Bob: Accredited Verifier">', to: '<button type="button" class="btn btn-outline btn-sm btn-demo-bob" onclick="fillDemoLogin(\'bob@commit.fun\', \'Demo1234!\')" title="Bob: Accredited Verifier">' },
  { from: '<button type="button" class="btn btn-outline btn-sm" onclick="fillDemoLogin(\'admin@commit.fun\', \'Demo1234!\')" style="font-size:0.7rem;padding:0.4rem 0.15rem;text-align:center;border-color:rgba(153,69,255,0.3);line-height:1.2;" title="Charlie: Protocol Admin">', to: '<button type="button" class="btn btn-outline btn-sm btn-demo-charlie" onclick="fillDemoLogin(\'admin@commit.fun\', \'Demo1234!\')" title="Charlie: Protocol Admin">' },
  { from: '<button type="button" class="btn btn-outline btn-sm" onclick="fillDemoLogin(\'david@commit.fun\', \'Demo1234!\')" style="font-size:0.7rem;padding:0.4rem 0.15rem;text-align:center;border-color:rgba(255,184,0,0.3);line-height:1.2;" title="David: Goal Achiever">', to: '<button type="button" class="btn btn-outline btn-sm btn-demo-david" onclick="fillDemoLogin(\'david@commit.fun\', \'Demo1234!\')" title="David: Goal Achiever">' },
  { from: '<span style="font-size:0.62rem;color:var(--text-muted)">Creator</span>', to: '<span class="demo-sublabel">Creator</span>' },
  { from: '<span style="font-size:0.62rem;color:var(--text-muted)">Verifier</span>', to: '<span class="demo-sublabel">Verifier</span>' },
  { from: '<span style="font-size:0.62rem;color:var(--text-muted)">Admin</span>', to: '<span class="demo-sublabel">Admin</span>' },
  { from: '<span style="font-size:0.62rem;color:var(--text-muted)">Achiever</span>', to: '<span class="demo-sublabel">Achiever</span>' },
  { from: '<button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem;" id="btnLoginSubmit">', to: '<button type="submit" class="btn btn-primary btn-auth-submit" id="btnLoginSubmit">' },
  { from: '<button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem;" id="btnSignupSubmit">', to: '<button type="submit" class="btn btn-primary btn-auth-submit" id="btnSignupSubmit">' },
  { from: '<button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem;" id="btnForgotSubmit">', to: '<button type="submit" class="btn btn-primary btn-auth-submit" id="btnForgotSubmit">' },
  { from: '<form id="formSignUp" onsubmit="handleSignUp(event)" style="display:none;">', to: '<form id="formSignUp" class="hidden" onsubmit="handleSignUp(event)">' },
  { from: '<form id="formForgot" onsubmit="handleForgotPassword(event)" style="display:none;">', to: '<form id="formForgot" class="hidden" onsubmit="handleForgotPassword(event)">' },
  { from: '<span style="color:var(--sol-purple)">dY>,?</span> Phantom Cryptographic Binding', to: '<span class="modal-title-purple">🛡️</span> Phantom Cryptographic Binding' },
  { from: '<span style="color:var(--sol-purple)">🛡️</span> Phantom Cryptographic Binding', to: '<span class="modal-title-purple">🛡️</span> Phantom Cryptographic Binding' },
  { from: '<button class="close-btn" onclick="closeWalletModal()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;">&times;</button>', to: '<button class="close-btn modal-close-icon" onclick="closeWalletModal()">&times;</button>' },
  { from: '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;">', to: '<p class="wallet-challenge-desc">' },
  { from: '<button class="btn btn-primary" style="width:100%;" id="btnSignWalletAction" onclick="executeWalletSignatureChallenge()">', to: '<button class="btn btn-primary btn-w-full" id="btnSignWalletAction" onclick="executeWalletSignatureChallenge()">' }
];

let replacedCount = 0;
for (const r of replacements) {
  if (html.includes(r.from)) {
    html = html.split(r.from).join(r.to);
    replacedCount++;
  }
}

fs.writeFileSync('public/index.html', html, 'utf8');

// Check remaining inline styles
const remainingMatches = html.match(/style="[^"]+"/g) || [];
console.log(`Replaced mappings: ${replacedCount}`);
console.log(`Remaining inline styles in index.html: ${remainingMatches.length}`);
if (remainingMatches.length > 0) {
  console.log('Sample remaining:');
  remainingMatches.slice(0, 10).forEach(m => console.log('  ', m));
}
