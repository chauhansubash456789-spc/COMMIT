
// =============================================================================
// THEME CONTROLLER (DEFAULT LIGHT THEME)
// =============================================================================
function initTheme() {
  const saved = localStorage.getItem('commit_theme') || 'light';
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('commit_theme', theme);
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  if (icon && text) {
    if (theme === 'light') {
      icon.textContent = '🌙';
      text.textContent = 'Dark';
    } else {
      icon.textContent = '☀️';
      text.textContent = 'Light';
    }
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
  if (typeof showToast === 'function') {
    showToast(`Switched to ${next.toUpperCase()} mode`);
  }
}

// Initialize theme immediately on script load
initTheme();

/**
 * COMMIT PROTOCOL CLIENT ENGINE (ROBUST & AUDITED)
 * Handles Web3 wallet state, API communication, live focus timer heartbeats,
 * GitHub verification, Peer consensus voting, and Solana Blinks simulation.
 */

const API_BASE = window.location.origin;

// Application State
const state = {
  wallet: {
    address: 'H4cK3rSolanaDev1111111111111111111111111111111',
    balanceUsdc: 250.00,
    balanceSol: 4.82,
    connected: true
  },
  commitments: [],
  activeTab: 'tab-dashboard',
  focusSession: {
    commitmentId: 'cm_study_02',
    timerInterval: null,
    heartbeatInterval: null,
    secondsElapsed: 0,
    requiredSeconds: 180,
    currentNonce: null,
    isRunning: false
  },
  selectedStakingMode: 'HARDCORE'
};

// DOM Elements
const elements = {
  commitmentsGrid: document.getElementById('commitmentsGrid'),
  statTotalCommitted: document.getElementById('statTotalCommitted'),
  statActiveCount: document.getElementById('statActiveCount'),
  statSuccessRate: document.getElementById('statSuccessRate'),
  walletUsdc: document.getElementById('walletUsdc'),
  walletSol: document.getElementById('walletSol'),
  walletAddress: document.getElementById('walletAddress'),
  // Focus timer
  timerDisplay: document.getElementById('timerDisplay'),
  timerStatusBadge: document.getElementById('timerStatusBadge'),
  heartbeatLog: document.getElementById('heartbeatLog'),
  startFocusBtn: document.getElementById('startFocusBtn'),
  finishFocusBtn: document.getElementById('finishFocusBtn'),
  // Blinks
  blinkTitle: document.getElementById('blinkTitle'),
  blinkDesc: document.getElementById('blinkDesc'),
  blinkActionBtn: document.getElementById('blinkActionBtn'),
  // Modal
  receiptModal: document.getElementById('receiptModal'),
  modalBody: document.getElementById('modalBody')
};

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupWizard();
  setupFocusTimer();
  setupDemos();
  setupModalDismiss();
  updateWalletDisplay();
  await loadCommitments();
  await loadPeerPortal();
  await loadBlinkPreview('cm_gh_01');
});

// -----------------------------------------------------------------------------
// NAVIGATION
// -----------------------------------------------------------------------------
function setupNavigation() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = btn.getAttribute('data-tab');

      // GUARD: Without login, no one can create commitments
      if (targetTab === 'tab-wizard' && (!state.auth || !state.auth.token)) {
        e.preventDefault();
        openAuthModal('signin');
        const alertBox = document.getElementById('authAlert');
        if (alertBox) {
          alertBox.className = 'auth-alert-box error';
          alertBox.style.display = 'block';
          alertBox.textContent = '🔒 Authentication Required: You must be logged in to create a commitment.';
        }
        return;
      }

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(targetTab);
      if (activePane) activePane.classList.add('active');
      state.activeTab = targetTab;
    });
  });
}

function updateWalletDisplay() {
  if (elements.walletUsdc) elements.walletUsdc.textContent = `${state.wallet.balanceUsdc.toFixed(2)} USDC`;
  if (elements.walletSol) elements.walletSol.textContent = `${state.wallet.balanceSol.toFixed(2)} SOL`;
  if (elements.walletAddress) {
    elements.walletAddress.textContent = `${state.wallet.address.slice(0, 4)}...${state.wallet.address.slice(-4)}`;
  }
}

window.requestAirdrop = function() {
  state.wallet.balanceUsdc += 100;
  state.wallet.balanceSol += 1.0;
  updateWalletDisplay();
  showToast('Devnet Airdrop Received: +100 USDC, +1.0 SOL');
};

// -----------------------------------------------------------------------------
// COMMITMENTS DASHBOARD
// -----------------------------------------------------------------------------
async function loadCommitments() {
  try {
    const res = await fetch(`${API_BASE}/api/commitments`);
    if (!res.ok) throw new Error('Failed to load commitments');
    state.commitments = await res.json();
    renderCommitments();
  } catch (err) {
    console.error('Failed to load commitments:', err);
  }
}

function renderCommitments() {
  if (!elements.commitmentsGrid) return;
  elements.commitmentsGrid.innerHTML = '';

  let totalUsdc = 0;
  let activeCount = 0;
  let settledCount = 0;
  let successCount = 0;

  state.commitments.forEach(c => {
    totalUsdc += Number(c.stakeAmount) || 0;
    if (c.status === 'ACTIVE' || c.status === 'PENDING_VERIFICATION') activeCount++;
    if (c.status === 'SETTLED') {
      settledCount++;
      if (c.settlement && c.settlement.recipientPayout === c.stakeAmount) successCount++;
    }

    const card = document.createElement('div');
    card.className = 'commit-card';

    const isNoLoss = c.stakingMode === 'NOLOSS';
    const modeBadgeClass = isNoLoss ? 'noloss' : 'hardcore';
    const modeBadgeText = isNoLoss ? '🛡️ No-Loss Yield' : '🔥 Hardcore Principal';

    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="mode-badge ${modeBadgeClass}">${modeBadgeText}</span>
          <span class="status-badge ${c.status.toLowerCase()}">${c.status.replace('_', ' ')}</span>
        </div>
        <h3 class="card-title">${escapeHtml(c.title)}</h3>
        <div class="card-metric-row">
          <div class="metric-item">
            <span>Stake Locked</span>
            <span>${c.stakeAmount} USDC</span>
          </div>
          <div class="metric-item">
            <span>Verifier</span>
            <span style="text-transform:uppercase">${c.verifierType}</span>
          </div>
          <div class="metric-item">
            <span>Fee</span>
            <span>${c.verificationFee} USDC</span>
          </div>
        </div>
        <div class="consequence-box">
          <strong>Consequence:</strong> ${escapeHtml(c.failurePolicyText)}
        </div>
      </div>
      <div class="card-actions">
        ${renderCardButtons(c)}
      </div>
    `;

    elements.commitmentsGrid.appendChild(card);
  });

  if (elements.statTotalCommitted) elements.statTotalCommitted.textContent = `${totalUsdc} USDC`;
  if (elements.statActiveCount) elements.statActiveCount.textContent = activeCount;
  if (elements.statSuccessRate) {
    const rate = settledCount > 0 ? Math.round((successCount / settledCount) * 100) : 100;
    elements.statSuccessRate.textContent = `${rate}%`;
  }
}

function renderCardButtons(c) {
  if (c.status === 'ACTIVE') {
    if (c.verifierType === 'github') {
      return `<button class="btn btn-primary btn-sm btn-full" onclick="verifyGitHubCommitment('${c.id}')">⚡ Verify GitHub Commits</button>`;
    }
    if (c.verifierType === 'study_timer') {
      return `<button class="btn btn-purple btn-sm btn-full" onclick="openFocusTab('${c.id}')">⏱️ Open Focus Studio</button>`;
    }
    if (c.verifierType === 'peer_consensus') {
      return `<button class="btn btn-secondary btn-sm btn-full" onclick="openPeerTab('${c.id}')">👥 Submit/View Proof</button>`;
    }
  }
  if (c.status === 'PENDING_VERIFICATION') {
    return `<button class="btn btn-secondary btn-sm btn-full" onclick="openPeerTab('${c.id}')">⏳ Under Peer Review (2/3)</button>`;
  }
  if (c.status === 'VERIFIED') {
    return `<button class="btn btn-primary btn-sm btn-full" onclick="settleCommitment('${c.id}')">🏛️ Execute Solana Settlement</button>`;
  }
  if (c.status === 'SETTLED') {
    return `<button class="btn btn-secondary btn-sm btn-full" onclick="viewReceipt('${c.id}')">📜 View Devnet Receipt</button>`;
  }
  return '';
}

// -----------------------------------------------------------------------------
// CREATION WIZARD
// -----------------------------------------------------------------------------
function setupWizard() {
  const modeCards = document.querySelectorAll('.mode-option-card');
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedStakingMode = card.getAttribute('data-mode');
      updateWizardPreview();
    });
  });

  const stakeInput = document.getElementById('wizardStake');
  const verifierSelect = document.getElementById('wizardVerifier');
  if (stakeInput) stakeInput.addEventListener('input', updateWizardPreview);
  if (verifierSelect) verifierSelect.addEventListener('change', updateWizardPreview);

  const form = document.getElementById('commitmentWizardForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCreateCommitment();
    });
  }

  updateWizardPreview();
}

function updateWizardPreview() {
  const stake = Number(document.getElementById('wizardStake')?.value) || 20;
  const isNoLoss = state.selectedStakingMode === 'NOLOSS';
  const previewBox = document.getElementById('wizardConsequencePreview');

  if (previewBox) {
    if (isNoLoss) {
      previewBox.innerHTML = `
        <strong>🛡️ No-Loss Yield Protection Active:</strong><br>
        Your <strong>${stake} USDC</strong> principal is locked in Kamino/MarginFi lending vault and is <strong>100% safe</strong>.<br>
        • On Success: You receive ${stake} USDC + accrued yield + Streak Soulbound NFT.<br>
        • On Failure: Only accrued yield (~${(stake * 0.08).toFixed(2)} USDC) is forfeited to verifiers.
      `;
    } else {
      const penalty = Math.round(stake * 0.25);
      previewBox.innerHTML = `
        <strong>🔥 Hardcore Principal Stake:</strong><br>
        You are locking <strong>${stake} USDC</strong> in Solana Escrow PDA.<br>
        • On Success: 100% (${stake} USDC) returned to your wallet.<br>
        • On Failure: <strong>${stake - penalty} USDC</strong> returned, <strong>${penalty} USDC</strong> sent to Developer Education Pool.
      `;
    }
  }
}

async function handleCreateCommitment() {
  // STRICT GUARD: Must be authenticated
  if (!state.auth || !state.auth.token) {
    openAuthModal('signin');
    const alertBox = document.getElementById('authAlert');
    if (alertBox) {
      alertBox.className = 'auth-alert-box error';
      alertBox.style.display = 'block';
      alertBox.textContent = '🔒 Authentication Required: You must be logged in to create a commitment.';
    }
    return;
  }

  const title = document.getElementById('wizardTitle').value;
  const verifierType = document.getElementById('wizardVerifier').value;
  const stakeAmount = Number(document.getElementById('wizardStake').value);
  const isNoLoss = state.selectedStakingMode === 'NOLOSS';
  const penaltyAmount = isNoLoss ? Math.round(stakeAmount * 0.08) : Math.round(stakeAmount * 0.25);

  const payload = {
    title,
    creator: state.wallet.address,
    stakingMode: state.selectedStakingMode,
    stakeAmount,
    penaltyAmount,
    verificationFee: 1.5,
    verifierType,
    failurePolicy: isNoLoss ? 'YIELD_FORFEIT' : 'PARTIAL_RETURN',
    failurePolicyText: isNoLoss 
      ? `Principal safe, ~${penaltyAmount} USDC yield forfeited`
      : `${stakeAmount - penaltyAmount} USDC back, ${penaltyAmount} USDC to Education Pool`,
    details: {
      repoOwner: 'solana-labs',
      repoName: 'solana',
      authorUsername: 'solana-builder',
      requiredCommits: 5,
      requiredMinutes: 3
    }
  };

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.auth && state.auth.token) {
      headers['Authorization'] = `Bearer ${state.auth.token}`;
    }
    const res = await fetch(`${API_BASE}/api/commitments/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create commitment');
    }
    const newCommitment = await res.json();

    // Auto-fund for demo flow
    await fetch(`${API_BASE}/api/commitments/${newCommitment.id}/fund`, { method: 'POST' });

    // Deduct from wallet balance
    state.wallet.balanceUsdc -= stakeAmount + 1.5;
    updateWalletDisplay();

    showToast(`🎉 Commitment Created & Locked in Solana Escrow! (ID: ${newCommitment.id})`);
    await loadCommitments();

    // Switch back to dashboard
    const dashBtn = document.querySelector('[data-tab="tab-dashboard"]');
    if (dashBtn) dashBtn.click();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// GITHUB VERIFIER
// -----------------------------------------------------------------------------
window.verifyGitHubCommitment = async function(commitmentId) {
  showToast('🔍 Querying GitHub repository commits & validating SHAs...');
  
  // Read inputs if present on page
  const repoInput = document.getElementById('ghRepoInput')?.value.trim();
  const userInput = document.getElementById('ghUserInput')?.value.trim();
  const requiredInput = document.getElementById('ghRequiredInput')?.value;

  const bodyData = { commitmentId };
  if (repoInput && repoInput.includes('/')) {
    const [owner, name] = repoInput.split('/');
    bodyData.repoOwner = owner;
    bodyData.repoName = name;
  }
  if (userInput) bodyData.authorUsername = userInput;
  if (requiredInput) bodyData.requiredCommits = Number(requiredInput);

  try {
    const res = await fetch(`${API_BASE}/api/verify/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Verification failed');
    }
    const data = await res.json();
    if (data.attestation) {
      showToast(`✅ GitHub Verified! Code: ${data.attestation.resultCode} | Ed25519 Signed!`);
      
      // Render verified commits feed if container exists
      const resultsFeed = document.getElementById('ghResultsFeed');
      if (resultsFeed && Array.isArray(data.commits)) {
        resultsFeed.innerHTML = `
          <div style="margin-top:1rem;background:rgba(0,0,0,0.5);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;">
            <div style="font-weight:700;font-size:0.85rem;color:var(--sol-emerald);margin-bottom:0.5rem;">
              Qualifying Commits Verified (${data.attestation.verifiedMetric}/${data.attestation.requiredMetric})
            </div>
            ${data.commits.map(c => `
              <div style="font-family:var(--font-mono);font-size:0.75rem;padding:0.25rem 0;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;justify-content:space-between;">
                <span style="color:var(--sol-cyan)">${c.sha.slice(0, 10)}</span>
                <span style="color:var(--text-muted);max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.msg || c.message)}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      await loadCommitments();
    }
  } catch (err) {
    showToast(`Verification error: ${err.message}`);
  }
};

// -----------------------------------------------------------------------------
// DEEP WORK FOCUS TIMER
// -----------------------------------------------------------------------------
function setupFocusTimer() {
  if (elements.startFocusBtn) {
    elements.startFocusBtn.addEventListener('click', toggleFocusSession);
  }
  if (elements.finishFocusBtn) {
    elements.finishFocusBtn.addEventListener('click', finishFocusSession);
  }
}

async function toggleFocusSession() {
  const session = state.focusSession;
  if (!session.isRunning) {
    // Start session on server
    try {
      const res = await fetch(`${API_BASE}/api/verify/study/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitmentId: session.commitmentId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start session');
      }
      const data = await res.json();
      session.currentNonce = data.nonce;
      session.isRunning = true;
      session.secondsElapsed = 0;

      elements.startFocusBtn.textContent = '⏸️ Pause Focus';
      elements.startFocusBtn.classList.replace('btn-primary', 'btn-secondary');
      elements.timerStatusBadge.textContent = '● LIVE VERIFIED FOCUS SESSION';
      elements.timerStatusBadge.style.color = 'var(--sol-emerald)';

      logHeartbeat(`Session initialized with Server Nonce: 0x${session.currentNonce.slice(0, 10)}...`);

      // Timer tick every second
      session.timerInterval = setInterval(() => {
        session.secondsElapsed++;
        updateTimerDisplay();
      }, 1000);

      // Heartbeat every 5 seconds (accelerated for interactive demo)
      session.heartbeatInterval = setInterval(async () => {
        try {
          const hbRes = await fetch(`${API_BASE}/api/verify/study/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              commitmentId: session.commitmentId,
              clientNonce: session.currentNonce,
              wasFocused: !document.hidden
            })
          });
          if (!hbRes.ok) {
            const err = await hbRes.json();
            throw new Error(err.error || 'Heartbeat rejected');
          }
          const hbData = await hbRes.json();
          session.currentNonce = hbData.nextNonce;
          logHeartbeat(`Heartbeat verified ✓ Active: ${hbData.verifiedActiveSeconds}s | Next Nonce: 0x${hbData.nextNonce.slice(0, 8)}...`);
        } catch (e) {
          logHeartbeat(`⚠️ Heartbeat anomaly: ${e.message}`);
        }
      }, 5000);

    } catch (err) {
      showToast(`Failed to start focus session: ${err.message}`);
    }
  } else {
    // Pause
    clearInterval(session.timerInterval);
    clearInterval(session.heartbeatInterval);
    session.isRunning = false;
    elements.startFocusBtn.textContent = '▶️ Resume Focus';
    elements.startFocusBtn.classList.replace('btn-secondary', 'btn-primary');
    elements.timerStatusBadge.textContent = 'PAUSED';
    elements.timerStatusBadge.style.color = 'var(--sol-amber)';
    logHeartbeat('Session paused');
  }
}

function updateTimerDisplay() {
  const remaining = Math.max(0, state.focusSession.requiredSeconds - state.focusSession.secondsElapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  if (elements.timerDisplay) {
    elements.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

function logHeartbeat(msg) {
  if (!elements.heartbeatLog) return;
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  elements.heartbeatLog.prepend(line);
}

async function finishFocusSession() {
  const session = state.focusSession;
  clearInterval(session.timerInterval);
  clearInterval(session.heartbeatInterval);
  session.isRunning = false;

  showToast('Generating Ed25519 signed focus attestation...');
  try {
    const res = await fetch(`${API_BASE}/api/verify/study/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitmentId: session.commitmentId,
        simulatedActiveSeconds: session.secondsElapsed >= 180 ? 180 : session.secondsElapsed
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to finish session');
    }
    const data = await res.json();
    logHeartbeat(`Attestation Signed! Result: ${data.attestation.resultCode}`);
    showToast(`Study Attestation: ${data.attestation.resultCode}! Valid Signature: ${data.isSignatureValid}`);
    await loadCommitments();
  } catch (err) {
    showToast(`Error finishing session: ${err.message}`);
  }
}

window.openFocusTab = function(commitmentId) {
  state.focusSession.commitmentId = commitmentId;
  const tabBtn = document.querySelector('[data-tab="tab-study"]');
  if (tabBtn) tabBtn.click();
};

// -----------------------------------------------------------------------------
// PEER CONSENSUS VERIFIER PORTAL
// -----------------------------------------------------------------------------
async function loadPeerPortal() {
  try {
    const challengeRes = await fetch(`${API_BASE}/api/verify/peer/challenge/cm_peer_03`);
    if (challengeRes.ok) {
      const challenge = await challengeRes.json();
      const challengeCodeElem = document.getElementById('peerChallengeCode');
      if (challengeCodeElem) challengeCodeElem.textContent = challenge.challengeCode;
    }

    const taskRes = await fetch(`${API_BASE}/api/verify/peer/task/cm_peer_03`);
    if (taskRes.ok) {
      const task = await taskRes.json();
      const votesBox = document.getElementById('peerVotesStatus');
      if (votesBox) {
        if (task.votes && task.votes.length > 0) {
          votesBox.innerHTML = `
            <div style="font-size:0.8rem;margin-top:0.5rem;color:var(--sol-cyan);">
              Votes Recorded (${task.votes.length}/3): 
              ${task.votes.map(v => `<span style="font-weight:700;color:${v.vote === 'PASS' ? 'var(--sol-emerald)' : 'var(--sol-rose)'}">${v.verifierId}: ${v.vote}</span>`).join(', ')}
              ${task.consensusReached ? ' • <strong>Consensus Reached ✓</strong>' : ''}
            </div>
          `;
        } else {
          votesBox.innerHTML = `<div style="font-size:0.8rem;margin-top:0.5rem;color:var(--text-muted)">Awaiting peer votes (0/3)...</div>`;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load peer portal data:', err.message);
  }
}

window.openPeerTab = function(commitmentId) {
  const tabBtn = document.querySelector('[data-tab="tab-peer"]');
  if (tabBtn) tabBtn.click();
};

window.castPeerVote = async function(defaultVerifierId, vote) {
  try {
    // Check if verifier dropdown exists
    const verifierSelect = document.getElementById('peerVerifierSelect');
    const verifierId = verifierSelect ? verifierSelect.value : (defaultVerifierId || 'v_alex');

    const res = await fetch(`${API_BASE}/api/verify/peer/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitmentId: 'cm_peer_03',
        verifierId,
        vote,
        notes: `Peer review conducted. Dynamic blockhash challenge code confirmed.`
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Vote rejected');
    }
    const data = await res.json();

    if (data.consensusReached) {
      showToast(`🎉 2-of-3 Peer Consensus Reached! Attestation Generated: ${data.attestation.resultCode}`);
      // Reward the verifier
      state.wallet.balanceUsdc += 1.5;
      updateWalletDisplay();
    } else {
      showToast(`Vote recorded (${data.votesCount}/3). Awaiting next verifier.`);
    }

    await loadCommitments();
    await loadPeerPortal();
  } catch (err) {
    showToast(`Vote info: ${err.message}`);
  }
};

// -----------------------------------------------------------------------------
// SOLANA BLINKS PREVIEW
// -----------------------------------------------------------------------------
async function loadBlinkPreview(commitmentId) {
  try {
    const res = await fetch(`${API_BASE}/api/actions/commit?id=${commitmentId}`);
    if (!res.ok) return;
    const metadata = await res.json();

    if (elements.blinkTitle) elements.blinkTitle.textContent = metadata.title;
    if (elements.blinkDesc) elements.blinkDesc.textContent = metadata.description;
    if (elements.blinkActionBtn) elements.blinkActionBtn.textContent = metadata.label;
  } catch (err) {
    console.error('Failed to load Blink:', err);
  }
}

window.simulateBlinkClick = async function() {
  showToast('⚡ Unfurling Solana Action in Phantom wallet...');
  try {
    const res = await fetch(`${API_BASE}/api/actions/commit?id=cm_gh_01`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: state.wallet.address })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Action failed');
    }
    const data = await res.json();
    showToast(`Dialect Action Response: ${data.message}`);
  } catch (err) {
    showToast(`Blink error: ${err.message}`);
  }
};

// -----------------------------------------------------------------------------
// SETTLEMENT & DEVNET EXPLORER
// -----------------------------------------------------------------------------
window.settleCommitment = async function(commitmentId) {
  showToast('🏛️ Executing Solana Devnet on-chain settlement...');
  try {
    const res = await fetch(`${API_BASE}/api/commitments/${commitmentId}/settle`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Settlement failed');
    }
    const data = await res.json();
    showToast('✨ Commitment Settled on Solana Devnet!');
    await loadCommitments();
    viewReceipt(commitmentId);
  } catch (err) {
    showToast(`Settlement error: ${err.message}`);
  }
};

window.viewReceipt = function(commitmentId) {
  const c = state.commitments.find(item => item.id === commitmentId);
  if (!c || !c.settlement) return;

  const body = document.getElementById('modalBody');
  if (body) {
    body.innerHTML = `
      <div class="explorer-receipt-box">
        <div class="receipt-row">
          <span>Cluster:</span>
          <span>${c.settlement.cluster.toUpperCase()}</span>
        </div>
        <div class="receipt-row">
          <span>Commitment ID:</span>
          <span>${c.id}</span>
        </div>
        <div class="receipt-row">
          <span>Outcome:</span>
          <span style="color:${c.attestation && c.attestation.isSuccessful ? 'var(--sol-emerald)' : 'var(--sol-rose)'}">
            ${c.attestation ? c.attestation.resultCode : 'SETTLED'} (${c.attestation && c.attestation.isSuccessful ? 'SUCCESS' : 'FAILURE'})
          </span>
        </div>
        <div class="receipt-row">
          <span>Recipient Payout:</span>
          <span>${c.settlement.recipientPayout} USDC</span>
        </div>
        <div class="receipt-row">
          <span>Penalty Dispatched:</span>
          <span>${c.settlement.penaltyTransferred} USDC</span>
        </div>
        <div class="receipt-row">
          <span>Verifier Reward Paid:</span>
          <span>${c.settlement.verifierFeePaid} USDC</span>
        </div>
        <hr style="border:none;border-top:1px solid var(--border-subtle);margin:0.75rem 0;">
        <div class="receipt-row">
          <span>Evidence Hash:</span>
          <span style="font-size:0.72rem;color:var(--sol-cyan)">${c.attestation ? c.attestation.evidenceHash : 'N/A'}</span>
        </div>
        <div class="receipt-row">
          <span>Oracle Ed25519 Sig:</span>
          <span style="font-size:0.72rem;color:var(--sol-purple)">${c.attestation && c.attestation.signature ? c.attestation.signature.slice(0, 32) + '...' : 'Verified'}</span>
        </div>
        <div class="receipt-row">
          <span>Solana Tx Signature:</span>
          <span style="font-size:0.72rem;color:#fff">${c.settlement.txSignature}</span>
        </div>
      </div>
      <a href="${c.settlement.explorerUrl}" target="_blank" class="btn btn-primary btn-full">
        🔍 View on Solana Explorer
      </a>
    `;
  }

  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.add('active');
};

window.closeModal = function() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.remove('active');
};

function setupModalDismiss() {
  const modal = document.getElementById('receiptModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// -----------------------------------------------------------------------------
// 1-CLICK DETERMINISTIC HACKATHON DEMOS
// -----------------------------------------------------------------------------
function setupDemos() {
  window.runDemo = async function(scenario) {
    showToast(`🚀 Executing Demo: ${scenario}...`);
    try {
      const res = await fetch(`${API_BASE}/api/demo/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Demo execution failed');
      }
      const data = await res.json();
      showToast(`🎯 Demo ${scenario} Complete! Solana Devnet Settlement Confirmed!`);
      await loadCommitments();
      viewReceipt(data.commitment.id);
    } catch (err) {
      showToast(`Demo error: ${err.message}`);
    }
  };
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------
function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #161b26;
    border: 1px solid var(--sol-cyan);
    color: #fff;
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    font-size: 0.85rem;
    font-weight: 600;
    z-index: 9999;
    animation: fadeIn 0.2s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


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
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
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
        if (el) el.textContent = `${data.profile.wallet_address.slice(0, 4)}...${data.profile.wallet_address.slice(-4)}`;
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

    section.innerHTML = `
      <div class="user-badge" id="userBadgeProfile">
        <div class="user-avatar-circle">${initial}</div>
        <div style="display:flex;flex-direction:column;line-height:1.2;">
          <span style="font-weight:600;color:#fff;">${escapeHtml(p.display_name)}</span>
          <span style="font-size:0.7rem;color:var(--text-muted);">@${escapeHtml(p.username)}</span>
        </div>
        <span class="role-pill ${roleClass}">${p.role}</span>
        ${p.status === 'SUSPENDED' ? '<span class="status-badge status-suspended">SUSPENDED</span>' : ''}
        ${hasWallet 
          ? `<span title="Cryptographically Verified Solana Wallet" style="font-size:0.75rem;color:var(--sol-emerald);background:rgba(20,241,149,0.1);padding:0.15rem 0.45rem;border-radius:20px;border:1px solid rgba(20,241,149,0.3);">✓ ${p.wallet_address.slice(0,4)}...${p.wallet_address.slice(-4)}</span>` 
          : `<button class="btn btn-outline btn-sm" onclick="openWalletModal()" style="font-size:0.7rem;padding:0.2rem 0.5rem;border-color:var(--sol-purple);color:var(--sol-purple);">🔗 Link Phantom</button>`
        }
        <button class="btn btn-outline btn-sm" onclick="handleLogout()" style="padding:0.2rem 0.5rem;font-size:0.7rem;margin-left:0.25rem;">Logout</button>
      </div>
    `;

    if (adminTab) {
      adminTab.style.display = state.auth.isAdmin ? 'inline-flex' : 'none';
    }
  } else {
    section.innerHTML = `
      <button class="btn btn-outline btn-sm" id="btnOpenAuth" onclick="openAuthModal('signin')" style="border-color:rgba(0,240,255,0.4);color:var(--sol-cyan);">
        <span>🔑 Sign In / Register</span>
      </button>
    `;
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

    const res = await fetch(`${API_BASE}/api/auth/login`, {
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
    showToast(`Welcome back, ${data.profile.display_name}!`);
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

    const res = await fetch(`${API_BASE}/api/auth/signup`, {
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
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
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
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
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
    const nonceRes = await fetch(`${API_BASE}/api/auth/wallet/nonce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
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
    const verifyRes = await fetch(`${API_BASE}/api/auth/wallet/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
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
    showToast(`Phantom wallet ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)} linked!`);
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
    const res = await fetch(`${API_BASE}/api/admin/audit-logs?limit=50`, {
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (!data.auditLogs || data.auditLogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">No audit records found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.auditLogs.map(log => `
      <tr>
        <td style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem;">${new Date(log.created_at).toLocaleString()}</td>
        <td><span style="font-weight:700;color:var(--sol-cyan);">${escapeHtml(log.action)}</span></td>
        <td><span style="color:var(--text-muted);">${escapeHtml(log.target_type)}</span></td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;">${escapeHtml(log.target_id)}</td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">${log.actor_user_id ? escapeHtml(log.actor_user_id.slice(0, 8) + '...') : 'SYSTEM'}</td>
        <td style="font-family:var(--font-mono);font-size:0.72rem;color:#cbd5e1;max-width:240px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(JSON.stringify(log.metadata || {}))}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#fca5a5;padding:2rem;">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// Hook into DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});

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
