import fs from 'fs';

// 1. Update public/index.html
let html = fs.readFileSync('public/index.html', 'utf8');

const demoBoxHtml = `        <!-- QUICK DEMO LOGINS -->
        <div class="demo-accounts-box" style="margin-bottom:1rem;padding:0.75rem;background:rgba(0,240,255,0.04);border:1px dashed rgba(0,240,255,0.25);border-radius:8px;">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;">
            <span style="display:flex;align-items:center;gap:0.35rem;">⚡ <strong>1-Click Demo Accounts</strong></span>
            <span class="badge-pill" style="font-size:0.65rem;background:rgba(20,241,149,0.15);color:var(--sol-emerald);padding:0.15rem 0.4rem;border-radius:4px;">Ready</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:0.35rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="fillDemoLogin('alice@commit.fun', 'Demo1234!')" style="font-size:0.7rem;padding:0.4rem 0.15rem;text-align:center;border-color:rgba(0,240,255,0.3);line-height:1.2;" title="Alice: Goal Creator / Staker">
              👤 <strong>Alice</strong><br><span style="font-size:0.62rem;color:var(--text-muted)">Creator</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="fillDemoLogin('bob@commit.fun', 'Demo1234!')" style="font-size:0.7rem;padding:0.4rem 0.15rem;text-align:center;border-color:rgba(20,241,149,0.3);line-height:1.2;" title="Bob: Accredited Verifier">
              🛡️ <strong>Bob</strong><br><span style="font-size:0.62rem;color:var(--text-muted)">Verifier</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="fillDemoLogin('admin@commit.fun', 'Demo1234!')" style="font-size:0.7rem;padding:0.4rem 0.15rem;text-align:center;border-color:rgba(153,69,255,0.3);line-height:1.2;" title="Charlie: Protocol Admin">
              ⚡ <strong>Charlie</strong><br><span style="font-size:0.62rem;color:var(--text-muted)">Admin</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="fillDemoLogin('david@commit.fun', 'Demo1234!')" style="font-size:0.7rem;padding:0.4rem 0.15rem;text-align:center;border-color:rgba(255,184,0,0.3);line-height:1.2;" title="David: Goal Achiever">
              🎯 <strong>David</strong><br><span style="font-size:0.62rem;color:var(--text-muted)">Achiever</span>
            </button>
          </div>
        </div>

        <!-- SIGN IN FORM -->`;

if (!html.includes('class="demo-accounts-box"')) {
  html = html.replace('        <!-- SIGN IN FORM -->', demoBoxHtml);
  fs.writeFileSync('public/index.html', html, 'utf8');
  console.log('✅ Added 1-Click Demo Accounts box to public/index.html');
} else {
  console.log('ℹ️ demo-accounts-box already in public/index.html');
}

// 2. Update public/js/app.js
let js = fs.readFileSync('public/js/app.js', 'utf8');

const demoHelperCode = `
// -------------------------------------------------------------
// 1-Click Demo Accounts Quick Login Helper
// -------------------------------------------------------------
window.fillDemoLogin = function(email, password) {
  if (typeof switchAuthTab === 'function') switchAuthTab('signin');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  if (emailInput && passInput) {
    emailInput.value = email;
    passInput.value = password;
    const form = document.getElementById('formSignIn');
    if (form) {
      const submitEvt = new Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvt);
    }
  }
};
`;

if (!js.includes('fillDemoLogin')) {
  js += demoHelperCode;
  fs.writeFileSync('public/js/app.js', js, 'utf8');
  console.log('✅ Added fillDemoLogin helper to public/js/app.js');
} else {
  console.log('ℹ️ fillDemoLogin already in public/js/app.js');
}
