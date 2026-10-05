import fs from 'fs';

let js = fs.readFileSync('public/js/app.js', 'utf8');

if (!js.includes('function initAuth()')) {
  const authCode = `
// =============================================================================
// COMMIT AUTHENTICATION & SOLANA WALLET CRYPTOGRAPHIC BINDING
// =============================================================================

state.auth = {
  token: localStorage.getItem('commit_token') || null,
  user: null,
  profile: null,
  stats: null,
  isAdmin: false
};

// Initialize Auth on startup
async function initAuth() {
  const token = localStorage.getItem('commit_token');
  if (!token) {
    updateAuthUI();
    return;
  }

  try {
    const res = await fetch(\`\${API_BASE}/api/auth/me\`, {
      headers: { Authorization: \`Bearer \${token}\` }
    });

    if (res.ok) {
      const data = await res.json();
      state.auth.token = token;
      state.auth.user = data.user;
      state.auth.profile = data.profile;
      state.auth.stats = data.stats;
      state.auth.isAdmin = data.profile.role === 'ADMIN' || data.profile.role === 'SUPER_ADMIN';

      if (data.profile.wallet_address) {
        state.wallet.address = data.profile.wallet_address;
        const el = document.getElementById('walletAddress');
        if (el) el.textContent = \`\${data.profile.wallet_address.slice(0, 4)}...\${data.profile.wallet_address.slice(-4)}\`;
      }
    } else {
      localStorage.removeItem('commit_token');
      state.auth.token = null;
      state.auth.user = null;
      state.auth.profile = null;
    }
  } catch (err) {
    console.warn('[Auth Init] Error connecting to auth server:', err);
  }

  updateAuthUI();
}

function updateAuthUI() {
  const section = document.getElementById('authHeaderSection');
  const adminTab = document.getElementById('navTabAdmin');
  if (!section) return;

  if (state.auth.user && state.auth.profile) {
    const p = state.auth.profile;
    const initial = (p.display_name || p.username || 'U').charAt(0).toUpperCase();
    const roleClass = p.role === 'ADMIN' || p.role === 'SUPER_ADMIN' ? 'role-admin' : p.role === 'VERIFIER' ? 'role-verifier' : 'role-user';
    const hasWallet = Boolean(p.wallet_address);

    section.innerHTML = \`
      <div class="user-badge" id="userBadgeProfile">
        <div class="user-avatar-circle">\${initial}</div>
        <div style="display:flex;flex-direction:column;line-height:1.2;">
          <span style="font-weight:600;color:#fff;">\${escapeHtml(p.display_name)}</span>
          <span style="font-size:0.7rem;color:var(--text-muted);">@\${escapeHtml(p.username)}</span>
        </div>
        <span class="role-pill \${roleClass}">\${p.role}</span>
        \${p.status === 'SUSPENDED' ? '<span class="status-badge status-suspended">SUSPENDED</span>' : ''}
        \${hasWallet 
          ? \`<span title="Cryptographically Verified Solana Wallet" style="font-size:0.75rem;color:var(--sol-emerald);background:rgba(20,241,149,0.1);padding:0.15rem 0.45rem;border-radius:20px;border:1px solid rgba(20,241,149,0.3);">✓ \${p.wallet_address.slice(0,4)}...\${p.wallet_address.slice(-4)}</span>\` 
          : \`<button class="btn btn-outline btn-sm" onclick="openWalletModal()" style="font-size:0.7rem;padding:0.2rem 0.5rem;border-color:var(--sol-purple);color:var(--sol-purple);">🔗 Link Phantom</button>\`
        }
        <button class="btn btn-outline btn-sm" onclick="handleLogout()" style="padding:0.2rem 0.5rem;font-size:0.7rem;margin-left:0.25rem;">Logout</button>
      </div>
    \`;

    if (adminTab) {
      adminTab.style.display = state.auth.isAdmin ? 'inline-flex' : 'none';
    }
  } else {
    section.innerHTML = \`
      <button class="btn btn-outline btn-sm" id="btnOpenAuth" onclick="openAuthModal('signin')" style="border-color:rgba(0,240,255,0.4);color:var(--sol-cyan);">
        <span>🔑 Sign In / Register</span>
      </button>
    \`;
    if (adminTab) adminTab.style.display = 'none';
  }
}

function openAuthModal(tab = 'signin') {
  const modal = document.getElementById('authModalOverlay');
  if (modal) {
    modal.classList.add('open');
    switchAuthTab(tab);
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModalOverlay');
  if (modal) modal.classList.remove('open');
  clearAuthAlert();
}

function switchAuthTab(tab) {
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
}

function showAuthAlert(msg, isError = true) {
  const el = document.getElementById('authAlert');
  if (!el) return;
  el.className = isError ? 'auth-alert-box error' : 'auth-alert-box success';
  el.textContent = msg;
}

function clearAuthAlert() {
  const el = document.getElementById('authAlert');
  if (el) {
    el.className = 'auth-alert-box';
    el.textContent = '';
  }
}

async function handleSignIn(e) {
  e.preventDefault();
  clearAuthAlert();
  const btn = document.getElementById('btnLoginSubmit');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const res = await fetch(\`\${API_BASE}/api/auth/login\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('commit_token', data.session.access_token);
    state.auth.token = data.session.access_token;
    state.auth.user = data.user;
    state.auth.profile = data.profile;
    state.auth.stats = data.stats;
    state.auth.isAdmin = data.isAdmin;

    if (data.profile.wallet_address) {
      state.wallet.address = data.profile.wallet_address;
    }

    updateAuthUI();
    closeAuthModal();
    showToast(\`Welcome back, \${data.profile.display_name}!\`);
  } catch (err) {
    showAuthAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In to Commit';
  }
}

async function handleSignUp(e) {
  e.preventDefault();
  clearAuthAlert();
  const btn = document.getElementById('btnSignupSubmit');
  btn.disabled = true;
  btn.textContent = 'Creating Account...';

  try {
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const displayName = document.getElementById('signupDisplayName').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    const res = await fetch(\`\${API_BASE}/api/auth/signup\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, displayName, password, confirmPassword })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    if (data.session && data.session.access_token) {
      localStorage.setItem('commit_token', data.session.access_token);
      await initAuth();
    }

    showToast('Account registered successfully! Linking Phantom recommended.');
    closeAuthModal();
  } catch (err) {
    showAuthAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Commit Account';
  }
}

async function handleLogout() {
  const token = state.auth.token;
  if (token) {
    await fetch(\`\${API_BASE}/api/auth/logout\`, {
      method: 'POST',
      headers: { Authorization: \`Bearer \${token}\` }
    }).catch(() => {});
  }
  localStorage.removeItem('commit_token');
  state.auth = { token: null, user: null, profile: null, stats: null, isAdmin: false };
  updateAuthUI();
  showToast('Logged out successfully');
}

async function handleForgotPassword(e) {
  e.preventDefault();
  clearAuthAlert();
  const email = document.getElementById('forgotEmail').value.trim();
  const btn = document.getElementById('btnForgotSubmit');
  btn.disabled = true;

  try {
    const res = await fetch(\`\${API_BASE}/api/auth/forgot-password\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    showAuthAlert(data.message, false);
  } catch (err) {
    showAuthAlert('If an account exists for this email, a password reset link has been sent.', false);
  } finally {
    btn.disabled = false;
  }
}

function openWalletModal() {
  const modal = document.getElementById('walletChallengeModal');
  if (modal) modal.classList.add('open');
}

function closeWalletModal() {
  const modal = document.getElementById('walletChallengeModal');
  if (modal) modal.classList.remove('open');
}

// SOLANA PHANTOM WALLET NONCE & SIGNATURE HANDSHAKE
async function executeWalletSignatureChallenge() {
  const alertEl = document.getElementById('walletChallengeAlert');
  const btn = document.getElementById('btnSignWalletAction');

  if (!window.solana || !window.solana.isPhantom) {
    if (alertEl) {
      alertEl.className = 'auth-alert-box error';
      alertEl.textContent = 'Phantom wallet not detected. Please install Phantom extension from phantom.app';
    }
    return;
  }

  if (!state.auth.token) {
    if (alertEl) {
      alertEl.className = 'auth-alert-box error';
      alertEl.textContent = 'Please sign in to your Commit account before linking a Solana wallet.';
    }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Connecting Phantom...';

  try {
    // 1. Connect Phantom wallet
    const response = await window.solana.connect();
    const walletAddress = response.publicKey.toString();

    // 2. Request unique challenge nonce from server
    btn.textContent = 'Requesting Challenge Nonce...';
    const nonceRes = await fetch(\`\${API_BASE}/api/auth/wallet/nonce\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${state.auth.token}\`
      },
      body: JSON.stringify({ walletAddress })
    });

    const nonceData = await nonceRes.json();
    if (!nonceRes.ok) throw new Error(nonceData.error || 'Failed to generate challenge nonce');

    // 3. User signs canonical message with Phantom
    btn.textContent = 'Please Sign in Phantom Window...';
    const encodedMessage = new TextEncoder().encode(nonceData.message);
    const signedData = await window.solana.signMessage(encodedMessage, 'utf8');

    // Convert signature Uint8Array to Base58
    // Helper base58 encoder for browser
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    function toBase58(bytes) {
      const digits = [];
      for (let i = 0; i < bytes.length; i++) {
        let carry = bytes[i];
        for (let j = 0; j < digits.length; j++) {
          carry += digits[j] << 8;
          digits[j] = carry % 58;
          carry = (carry / 58) | 0;
        }
        while (carry > 0) {
          digits.push(carry % 58);
          carry = (carry / 58) | 0;
        }
      }
      let str = '';
      for (let i = 0; i < bytes.length && bytes[i] === 0; i++) str += '1';
      for (let i = digits.length - 1; i >= 0; i--) str += ALPHABET[digits[i]];
      return str;
    }

    const signatureBase58 = toBase58(signedData.signature);

    // 4. Verify signature on backend authoritatively
    btn.textContent = 'Verifying Signature...';
    const verifyRes = await fetch(\`\${API_BASE}/api/auth/wallet/verify\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${state.auth.token}\`
      },
      body: JSON.stringify({
        walletAddress,
        nonce: nonceData.nonce,
        signature: signatureBase58
      })
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(verifyData.error || 'Cryptographic verification failed');

    // 5. Update state
    state.wallet.address = walletAddress;
    state.auth.profile.wallet_address = walletAddress;
    updateAuthUI();
    closeWalletModal();
    showToast(\`Phantom wallet \${walletAddress.slice(0, 4)}...\${walletAddress.slice(-4)} linked!\`);
  } catch (err) {
    if (alertEl) {
      alertEl.className = 'auth-alert-box error';
      alertEl.textContent = err.message;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '✍️ Sign Challenge with Phantom';
  }
}

async function loadAdminAuditLogs() {
  const tbody = document.getElementById('adminAuditTableBody');
  if (!tbody || !state.auth.token) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">Fetching authoritative audit logs...</td></tr>';

  try {
    const res = await fetch(\`\${API_BASE}/api/admin/audit-logs?limit=50\`, {
      headers: { Authorization: \`Bearer \${state.auth.token}\` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (!data.auditLogs || data.auditLogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">No audit records found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.auditLogs.map(log => \`
      <tr>
        <td style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem;">\${new Date(log.created_at).toLocaleString()}</td>
        <td><span style="font-weight:700;color:var(--sol-cyan);">\${escapeHtml(log.action)}</span></td>
        <td><span style="color:var(--text-muted);">\${escapeHtml(log.target_type)}</span></td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;">\${escapeHtml(log.target_id)}</td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">\${log.actor_user_id ? escapeHtml(log.actor_user_id.slice(0, 8) + '...') : 'SYSTEM'}</td>
        <td style="font-family:var(--font-mono);font-size:0.72rem;color:#cbd5e1;max-width:240px;overflow:hidden;text-overflow:ellipsis;">\${escapeHtml(JSON.stringify(log.metadata || {}))}</td>
      </tr>
    \`).join('');
  } catch (err) {
    tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center;color:#fca5a5;padding:2rem;">Error: \${escapeHtml(err.message)}</td></tr>\`;
  }
}

// Hook into DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
`;
  js += '\n' + authCode;
  fs.writeFileSync('public/js/app.js', js, 'utf8');
  console.log('Successfully appended auth methods to public/js/app.js');
} else {
  console.log('public/js/app.js already has initAuth()');
}