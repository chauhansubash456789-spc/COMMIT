import fs from 'fs';

let html = fs.readFileSync('public/index.html', 'utf8');

// Update nav-tabs to minimalist labels while keeping all data-tabs and IDs intact
const oldNav = `<nav class="nav-tabs">
    <button class="nav-tab-btn active" data-tab="tab-dashboard">
      <span>⚡ Dashboard & Feed</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-wizard">
      <span>🎯 Create Commitment</span>
      <span class="badge-pill">Wizard</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-study">
      <span>⏱️ Deep Work Studio</span>
      <span class="badge-pill badge-pill-emerald">Live Heartbeats</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-github">
      <span>🐙 GitHub Verifier</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-peer">
      <span>👥 Peer Verifier Portal</span>
      <span class="badge-pill badge-pill-cyan">Blockhash</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-blinks">
      <span>🔗 Solana Blinks (Actions)</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-demos">
      <span>🧪 1-Click Hackathon Demos</span>
    </button>
    <button class="nav-tab-btn hidden" data-tab="tab-admin" id="navTabAdmin">
      <span>🛡️ Admin Audit Logs</span>
      <span class="badge-pill badge-pill-amber">RLS</span>
    </button>
  </nav>`;

const newNav = `<nav class="nav-tabs" aria-label="Main Navigation">
    <button class="nav-tab-btn active" data-tab="tab-dashboard">
      <span>⚡ Dashboard</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-wizard">
      <span>＋ Commit</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-study">
      <span>⏱️ Focus</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-github">
      <span>🐙 GitHub</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-peer">
      <span>👥 Peer</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-blinks">
      <span>🔗 Blinks</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-demos">
      <span>🧪 Demos</span>
    </button>
    <button class="nav-tab-btn hidden" data-tab="tab-admin" id="navTabAdmin">
      <span>🛡️ Admin</span>
    </button>
  </nav>`;

if (html.includes(oldNav)) {
  html = html.replace(oldNav, newNav);
  console.log('Nav replaced successfully');
} else {
  console.log('Old nav not found by exact string, checking line range');
}

fs.writeFileSync('public/index.html', html, 'utf8');
