import fs from 'fs';

let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Insert Auth Header Section next to wallet-badge
if (!html.includes('id="authHeaderSection"')) {
  const targetWalletBadge = '        <button class="btn btn-primary btn-sm" style="padding:0.2rem 0.6rem;font-size:0.7rem;margin-left:0.25rem;">+ Airdrop</button>\n      </div>';
  const newHeader = `        <button class="btn btn-primary btn-sm" style="padding:0.2rem 0.6rem;font-size:0.7rem;margin-left:0.25rem;">+ Airdrop</button>
      </div>

      <!-- AUTH USER / LOGIN SECTION -->
      <div id="authHeaderSection" style="display:flex;align-items:center;gap:0.5rem;">
        <button class="btn btn-outline btn-sm" id="btnOpenAuth" onclick="openAuthModal('signin')" style="border-color:rgba(0,240,255,0.4);color:var(--sol-cyan);">
          <span>🔑 Sign In / Register</span>
        </button>
      </div>`;
  html = html.replace(targetWalletBadge, newHeader);
}

// 2. Insert Admin Tab in Nav
if (!html.includes('id="navTabAdmin"')) {
  const targetNavEnd = '    <button class="nav-tab-btn" data-tab="tab-demos">\n      <span>🧪 1-Click Hackathon Demos</span>\n    </button>';
  const newNavEnd = `    <button class="nav-tab-btn" data-tab="tab-demos">
      <span>🧪 1-Click Hackathon Demos</span>
    </button>
    <button class="nav-tab-btn" data-tab="tab-admin" id="navTabAdmin" style="display:none;">
      <span>🛡️ Admin Audit Logs</span>
      <span class="badge-pill" style="background:rgba(245,158,11,0.2);color:#fbbf24">RLS</span>
    </button>`;
  html = html.replace(targetNavEnd, newNavEnd);
}

// 3. Insert Admin Section in Main
if (!html.includes('id="tab-admin"')) {
  const targetMainEnd = '    </section>\n\n  </main>';
  const newMainEnd = `    </section>

    <!-- TAB: ADMIN AUDIT LOGS -->
    <section id="tab-admin" class="tab-pane">
      <div class="glass-panel" style="padding:1.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;">
          <div>
            <h2 style="font-size:1.4rem;font-weight:700;color:#fff;">🛡️ Administrative Audit Trail</h2>
            <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.25rem;">Authoritative immutable logs recorded in Supabase PostgreSQL</p>
          </div>
          <button class="btn btn-outline btn-sm" onclick="loadAdminAuditLogs()">🔄 Refresh Logs</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="admin-audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target Type</th>
                <th>Target ID</th>
                <th>Actor User ID</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody id="adminAuditTableBody">
              <tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">Loading audit trail from Supabase...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

  </main>`;
  html = html.replace(targetMainEnd, newMainEnd);
}

// 4. Insert Modals before script
if (!html.includes('id="authModalOverlay"')) {
  const targetScript = '  <script src="js/app.js"></script>';
  const newModals = `  <!-- AUTHENTICATION MODAL -->
  <div class="auth-modal-overlay" id="authModalOverlay">
    <div class="auth-modal-card">
      <div class="auth-modal-header">
        <div class="auth-modal-title">
          <span style="color:var(--sol-cyan)">⚡</span> Commit Supabase Auth
        </div>
        <button class="close-btn" onclick="closeAuthModal()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;">&times;</button>
      </div>

      <div class="auth-tabs-row">
        <button class="auth-tab-item active" id="tabBtnSignIn" onclick="switchAuthTab('signin')">Sign In</button>
        <button class="auth-tab-item" id="tabBtnSignUp" onclick="switchAuthTab('signup')">Sign Up</button>
        <button class="auth-tab-item" id="tabBtnForgot" onclick="switchAuthTab('forgot')">Forgot Password</button>
      </div>

      <div class="auth-body">
        <div id="authAlert" class="auth-alert-box"></div>

        <!-- SIGN IN FORM -->
        <form id="formSignIn" onsubmit="handleSignIn(event)">
          <div class="auth-input-group">
            <label class="auth-label">Email Address</label>
            <input type="email" class="auth-input" id="loginEmail" required placeholder="you@example.com" />
          </div>
          <div class="auth-input-group">
            <label class="auth-label">Password</label>
            <input type="password" class="auth-input" id="loginPassword" required placeholder="••••••••" />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem;" id="btnLoginSubmit">
            Sign In to Commit
          </button>
        </form>

        <!-- SIGN UP FORM -->
        <form id="formSignUp" onsubmit="handleSignUp(event)" style="display:none;">
          <div class="auth-input-group">
            <label class="auth-label">Email Address</label>
            <input type="email" class="auth-input" id="signupEmail" required placeholder="you@example.com" />
          </div>
          <div class="auth-input-group">
            <label class="auth-label">Username (Unique)</label>
            <input type="text" class="auth-input" id="signupUsername" required placeholder="solana_chad" />
          </div>
          <div class="auth-input-group">
            <label class="auth-label">Display Name</label>
            <input type="text" class="auth-input" id="signupDisplayName" required placeholder="Alice Auditor" />
          </div>
          <div class="auth-input-group">
            <label class="auth-label">Password (Min 8 chars)</label>
            <input type="password" class="auth-input" id="signupPassword" required placeholder="••••••••" />
          </div>
          <div class="auth-input-group">
            <label class="auth-label">Confirm Password</label>
            <input type="password" class="auth-input" id="signupConfirmPassword" required placeholder="••••••••" />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem;" id="btnSignupSubmit">
            Create Commit Account
          </button>
        </form>

        <!-- FORGOT PASSWORD FORM -->
        <form id="formForgot" onsubmit="handleForgotPassword(event)" style="display:none;">
          <div class="auth-input-group">
            <label class="auth-label">Account Email Address</label>
            <input type="email" class="auth-input" id="forgotEmail" required placeholder="you@example.com" />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem;" id="btnForgotSubmit">
            Send Secure Reset Link
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- WALLET CHALLENGE MODAL -->
  <div class="auth-modal-overlay" id="walletChallengeModal">
    <div class="auth-modal-card">
      <div class="auth-modal-header">
        <div class="auth-modal-title">
          <span style="color:var(--sol-purple)">🛡️</span> Phantom Cryptographic Binding
        </div>
        <button class="close-btn" onclick="closeWalletModal()" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;">&times;</button>
      </div>
      <div class="auth-body">
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;">
          Sign a server nonce challenge with Phantom to prove cryptographic wallet ownership. No private key or seed phrase is ever requested.
        </p>
        <div id="walletChallengeAlert" class="auth-alert-box"></div>
        <button class="btn btn-primary" style="width:100%;" id="btnSignWalletAction" onclick="executeWalletSignatureChallenge()">
          ✍️ Sign Challenge with Phantom
        </button>
      </div>
    </div>
  </div>

  <script src="js/app.js"></script>`;
  html = html.replace(targetScript, newModals);
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('Successfully patched public/index.html');