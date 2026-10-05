import fs from 'fs';

console.log('--- REFACTORING AUTH MODAL, DEMO ACCOUNTS 2x2 GRID & SIGNUP VISIBILITY ---');

// 1. UPDATE public/index.html
let html = fs.readFileSync('public/index.html', 'utf8');

const oldDemoBoxPattern = /<!-- QUICK DEMO LOGINS -->[\s\S]*?<!-- SIGN IN FORM -->/;

const newDemoBoxAndForms = `<!-- QUICK DEMO LOGINS -->
        <div class="demo-accounts-box" id="authDemoAccountsBox">
          <div class="demo-box-header">
            <span class="demo-box-title">⚡ <strong>1-Click Demo Accounts</strong></span>
            <span class="badge-pill badge-pill-ready">Ready</span>
          </div>
          <div class="demo-grid-2x2">
            <button type="button" class="btn-demo-card" onclick="fillDemoLogin('alice@commit.fun', 'Demo1234!')" title="Alice: Goal Creator / Staker">
              <span class="demo-card-icon">👤</span>
              <div class="demo-card-info">
                <span class="demo-card-name">Alice Vance</span>
                <span class="demo-card-role">Creator</span>
              </div>
            </button>
            <button type="button" class="btn-demo-card" onclick="fillDemoLogin('bob@commit.fun', 'Demo1234!')" title="Bob: Accredited Verifier">
              <span class="demo-card-icon">🛡️</span>
              <div class="demo-card-info">
                <span class="demo-card-name">Bob Chen</span>
                <span class="demo-card-role">Verifier</span>
              </div>
            </button>
            <button type="button" class="btn-demo-card" onclick="fillDemoLogin('admin@commit.fun', 'Demo1234!')" title="Charlie: Protocol Admin">
              <span class="demo-card-icon">⚡</span>
              <div class="demo-card-info">
                <span class="demo-card-name">Charlie Miller</span>
                <span class="demo-card-role">Admin</span>
              </div>
            </button>
            <button type="button" class="btn-demo-card" onclick="fillDemoLogin('david@commit.fun', 'Demo1234!')" title="David: Goal Achiever">
              <span class="demo-card-icon">🎯</span>
              <div class="demo-card-info">
                <span class="demo-card-name">David Park</span>
                <span class="demo-card-role">Achiever</span>
              </div>
            </button>
          </div>
        </div>

        <!-- SIGN IN FORM -->`;

html = html.replace(oldDemoBoxPattern, newDemoBoxAndForms);

// Remove class="hidden" from formSignUp and formForgot in HTML so inline display switching works
html = html.replace('<form id="formSignUp" class="hidden"', '<form id="formSignUp"');
html = html.replace('<form id="formForgot" class="hidden"', '<form id="formForgot"');

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('✅ Updated public/index.html: 2x2 grid demo accounts and unblocked signup/forgot forms');

// 2. UPDATE public/css/style.css
let css = fs.readFileSync('public/css/style.css', 'utf8');

const authModalFixCss = `
/* ==========================================================================
   AUTH MODAL 2x2 GRID & TAB SWITCHING REFINEMENTS
   ========================================================================== */

#formSignUp,
#formForgot {
  display: none;
}

#formSignIn {
  display: block;
}

.auth-modal-card {
  max-width: 460px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.auth-body {
  padding: 1.5rem 1.75rem;
  overflow-y: auto;
  max-height: calc(90vh - 120px);
}

.demo-accounts-box {
  margin-bottom: 1.25rem;
  padding: 0.85rem 1rem;
  background: rgba(0, 240, 255, 0.05);
  border: 1px dashed rgba(0, 240, 255, 0.3);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

[data-theme="light"] .demo-accounts-box {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.demo-box-header {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.demo-grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.btn-demo-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  font-family: var(--font-family);
  width: 100%;
}

.btn-demo-card:hover {
  transform: translateY(-1px);
  border-color: var(--sol-purple);
  box-shadow: 0 4px 12px rgba(153, 69, 255, 0.15);
  background: rgba(153, 69, 255, 0.08);
}

[data-theme="light"] .btn-demo-card {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

[data-theme="light"] .btn-demo-card:hover {
  background: #f1f5f9;
  border-color: var(--sol-purple);
  box-shadow: 0 4px 10px rgba(153, 69, 255, 0.12);
}

.demo-card-icon {
  font-size: 1.15rem;
  flex-shrink: 0;
  line-height: 1;
}

.demo-card-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  line-height: 1.25;
}

.demo-card-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-theme="light"] .demo-card-name {
  color: #0f172a;
}

.demo-card-role {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 500;
}
`;

if (!css.includes('AUTH MODAL 2x2 GRID & TAB SWITCHING REFINEMENTS')) {
  css += '\n' + authModalFixCss;
  fs.writeFileSync('public/css/style.css', css, 'utf8');
  console.log('✅ Added 2x2 grid and modal responsive styles to public/css/style.css');
}

// 3. UPDATE public/js/app.js switchAuthTab
let js = fs.readFileSync('public/js/app.js', 'utf8');

const targetSwitchAuth = `function switchAuthTab(tab) {
  const btnIn = document.getElementById('tabBtnSignIn');
  const btnUp = document.getElementById('tabBtnSignUp');
  const btnFg = document.getElementById('tabBtnForgot');

  const formIn = document.getElementById('formSignIn');
  const formUp = document.getElementById('formSignUp');
  const formFg = document.getElementById('formForgot');

  if (!btnIn || !btnUp || !btnFg) return;
  btnIn.classList.remove('active');
  btnUp.classList.remove('active');
  btnFg.classList.remove('active');

  formIn.style.display = 'none';
  formUp.style.display = 'none';
  formFg.style.display = 'none';
  clearAuthAlert();

  if (tab === 'signup') {
    btnUp.classList.add('active');
    formUp.style.display = 'block';
  } else if (tab === 'forgot') {
    btnFg.classList.add('active');
    formFg.style.display = 'block';
  } else {
    btnIn.classList.add('active');
    formIn.style.display = 'block';
  }
}`;

const newSwitchAuth = `function switchAuthTab(tab) {
  const btnIn = document.getElementById('tabBtnSignIn');
  const btnUp = document.getElementById('tabBtnSignUp');
  const btnFg = document.getElementById('tabBtnForgot');

  const formIn = document.getElementById('formSignIn');
  const formUp = document.getElementById('formSignUp');
  const formFg = document.getElementById('formForgot');
  const demoBox = document.getElementById('authDemoAccountsBox') || document.querySelector('.demo-accounts-box');

  if (!btnIn || !btnUp || !btnFg) return;
  btnIn.classList.remove('active');
  btnUp.classList.remove('active');
  btnFg.classList.remove('active');

  if (formIn) formIn.style.display = 'none';
  if (formUp) formUp.style.display = 'none';
  if (formFg) formFg.style.display = 'none';
  clearAuthAlert();

  if (tab === 'signup') {
    btnUp.classList.add('active');
    if (formUp) formUp.style.display = 'block';
    if (demoBox) demoBox.style.display = 'none'; // Only show demo logins on Sign In tab
  } else if (tab === 'forgot') {
    btnFg.classList.add('active');
    if (formFg) formFg.style.display = 'block';
    if (demoBox) demoBox.style.display = 'none';
  } else {
    btnIn.classList.add('active');
    if (formIn) formIn.style.display = 'block';
    if (demoBox) demoBox.style.display = 'block';
  }
}`;

if (js.includes(targetSwitchAuth)) {
  js = js.replace(targetSwitchAuth, newSwitchAuth);
  fs.writeFileSync('public/js/app.js', js, 'utf8');
  console.log('✅ Updated switchAuthTab in public/js/app.js to toggle demoBox and forms smoothly');
} else {
  console.log('⚠️ Could not match exact targetSwitchAuth block');
}

console.log('\\n🎉 Auth modal fix completed!');
