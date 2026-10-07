import fs from 'fs';

console.log('--- ENHANCING HTML FOR TUBIK STUDIO DARK-CANVAS SYSTEM ---');

let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Plus Jakarta Sans font
html = html.replace('family=Outfit:wght@400;500;600;700;800;900', 'family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900');

// 2. Site selector pill in header
if (!html.includes('site-selector-pill')) {
  html = html.replace(
    '<p>Solana Verification Protocol</p>',
    '<span class="site-selector-pill">PROTOCOL // SOLANA ▾</span>'
  );
}

// 3. Circular utility button
if (!html.includes('utility-circle-btn')) {
  html = html.replace(
    '</button>\n      <div class="network-pill">',
    '</button>\n      <button class="utility-circle-btn" title="Live Protocol Activity">🔔</button>\n      <div class="network-pill">'
  );
}

// 4. Clean icons on tabs
const tabReplacements = [
  ['<span>dY"` Sign In / Register</span>', '<span>🔑 Sign In / Register</span>'],
  ['<span>dYZ_ Create Commitment</span>', '<span>🎯 Create Commitment</span>'],
  ['<span>dY?T GitHub Verifier</span>', '<span>🐙 GitHub Verifier</span>'],
  ['<span>dY` Peer Verifier Portal</span>', '<span>🛡️ Peer Verifier Portal</span>'],
  ['<span>dY"- Solana Blinks (Actions)</span>', '<span>⚡ Solana Blinks</span>'],
  ['<span>dY  1-Click Hackathon Demos</span>', '<span>🚀 1-Click Demos</span>'],
  ['<span>dY>,? Admin Audit Logs</span>', '<span>🔒 Admin Audit Logs</span>'],
  ['<div class="brand-logo-icon">s</div>', '<div class="brand-logo-icon">⚡</div>'],
  ['<span>s Dashboard & Feed</span>', '<span>📊 Dashboard & Feed</span>'],
  ['<span>?,? Deep Work Studio</span>', '<span>⏱️ Deep Work Studio</span>']
];

for (const [from, to] of tabReplacements) {
  if (html.includes(from)) {
    html = html.replace(from, to);
  }
}

// 5. Update stat cards in hero-stats to Tubik specification
const oldHeroStatsTarget = `<div class="stat-box">
              <div class="stat-label">Total Committed</div>
              <div class="stat-value highlight-emerald" id="statTotalCommitted">150 USDC</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Active Contracts</div>
              <div class="stat-value highlight-purple" id="statActiveCount">3</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Success Rate</div>
              <div class="stat-value" id="statSuccessRate">94%</div>
            </div>`;

const newHeroStatsTubik = `<div class="stat-box">
              <div class="stat-top-row">
                <span class="stat-label">Total Committed</span>
                <span class="badge-pill badge-pill-emerald">+18.4%</span>
              </div>
              <div class="stat-value" id="statTotalCommitted">150 USDC</div>
              <div class="stat-micro-desc">Locked in Solana Escrow PDAs</div>
            </div>
            <div class="stat-box">
              <div class="stat-top-row">
                <span class="stat-label">Active Contracts</span>
                <span class="badge-pill badge-pill-dark">Live Escrow</span>
              </div>
              <div class="stat-value text-inverted" id="statActiveCount">3</div>
              <div class="stat-micro-desc">Autonomous Oracle Verified</div>
            </div>
            <div class="stat-box">
              <div class="stat-top-row">
                <span class="stat-label">Protocol Success</span>
                <span class="badge-pill badge-pill-emerald">+2.4% All-Time</span>
              </div>
              <div class="stat-value" id="statSuccessRate">94%</div>
              <div class="stat-micro-desc">Settlement Accuracy</div>
            </div>`;

if (html.includes(oldHeroStatsTarget)) {
  html = html.replace(oldHeroStatsTarget, newHeroStatsTubik);
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('✅ public/index.html enhanced with Tubik Studio components');
