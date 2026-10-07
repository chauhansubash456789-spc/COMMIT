
// =============================================================================
// THEME CONTROLLER (DEFAULT LIGHT THEME)
// =============================================================================
function initTheme() {
  const saved = localStorage.getItem('commit_theme') || 'dark';
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
  myCommitments: [],
  currentCommitmentFilter: 'ALL',
  userStats: null,
  notifications: [],
  unreadNotifsCount: 0,
  wizardStep: 1,
  wizardType: 'github',
  auth: {
    token: null,
    user: null,
    profile: null,
    stats: null,
    isAdmin: false
  },
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

// DOM Elements (refreshed dynamically after components mount)
const elements = {};

function refreshDOMElements() {
  elements.commitmentsGrid = document.getElementById('commitmentsGrid');
  elements.statTotalCommitted = document.getElementById('statTotalCommitted');
  elements.statActiveCount = document.getElementById('statActiveCount');
  elements.statSuccessRate = document.getElementById('statSuccessRate');
  elements.walletUsdc = document.getElementById('walletUsdc');
  elements.walletSol = document.getElementById('walletSol');
  elements.walletAddress = document.getElementById('walletAddress');
  elements.timerDisplay = document.getElementById('timerDisplay');
  elements.timerStatusBadge = document.getElementById('timerStatusBadge');
  elements.heartbeatLog = document.getElementById('heartbeatLog');
  elements.startFocusBtn = document.getElementById('startFocusBtn');
  elements.finishFocusBtn = document.getElementById('finishFocusBtn');
  elements.blinkTitle = document.getElementById('blinkTitle');
  elements.blinkDesc = document.getElementById('blinkDesc');
  elements.blinkActionBtn = document.getElementById('blinkActionBtn');
  elements.receiptModal = document.getElementById('receiptModal');
  elements.modalBody = document.getElementById('modalBody');
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
async function startApp() {
  refreshDOMElements();
  setupNavigation();
  setupWizard();
  setupFocusTimer();
  setupDemos();
  setupModalDismiss();
  updateWalletDisplay();
  await loadCommitments();
  await loadPeerPortal();
  await loadBlinkPreview('cm_gh_01');
  await initAuth();
  if (new URLSearchParams(window.location.search).has('auth')) {
    setTimeout(() => { if (typeof openAuthModal === 'function') openAuthModal('signin'); }, 150);
  }
}

// Support both direct load and dynamic component injection:
if (window.__componentsLoading) {
  window.addEventListener('components:ready', startApp);
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// -----------------------------------------------------------------------------
// NAVIGATION
// -----------------------------------------------------------------------------
function setupNavigation() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetTab = btn.getAttribute('data-tab');

      // GUARD: Without login, no one can access create, my-commitments, or profile
      if ((targetTab === 'tab-wizard' || targetTab === 'tab-my-commitments' || targetTab === 'tab-profile') && (!state.auth || !state.auth.token)) {
        e.preventDefault();
        state.pendingTab = targetTab;
        openAuthModal('signin');
        const alertBox = document.getElementById('authAlert');
        if (alertBox) {
          alertBox.className = 'auth-alert-box error';
          alertBox.style.display = 'block';
          alertBox.textContent = `🔒 Authentication Required: Please sign in to access ${targetTab === 'tab-profile' ? 'your profile' : targetTab === 'tab-my-commitments' ? 'your commitments' : 'commitment creation'}.`;
        }
        return;
      }

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(targetTab);
      if (activePane) activePane.classList.add('active');
      state.activeTab = targetTab;

      if (targetTab === 'tab-dashboard') {
        await loadUserOverview();
        await loadCommitments();
      } else if (targetTab === 'tab-my-commitments') {
        await loadMyCommitments();
      } else if (targetTab === 'tab-profile') {
        loadUserProfile();
      } else if (targetTab === 'tab-wizard') {
        updateAuthUI();
      } else if (targetTab === 'tab-verifier') {
        await loadVerifierDashboardData();
      }
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

// =============================================================================
// USER DASHBOARD: OVERVIEW, MY COMMITMENTS, PROFILE, NOTIFICATIONS, MODAL
// =============================================================================

// -----------------------------------------------------------------------------
// 1. USER OVERVIEW METRICS
// -----------------------------------------------------------------------------
async function loadUserOverview() {
  if (!state.auth || !state.auth.token) {
    renderUserOverview(null);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/user/overview`, {
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });
    if (!res.ok) throw new Error('Failed to load user overview');
    const data = await res.json();
    state.userStats = data.stats;
    renderUserOverview(data.stats);
  } catch (err) {
    console.warn('[User Overview Error]:', err);
    renderUserOverview(null);
  }
}

function renderUserOverview(stats) {
  const cardActive = document.getElementById('cardActiveCount');
  const cardPending = document.getElementById('cardPendingCount');
  const cardCompleted = document.getElementById('cardCompletedCount');
  const cardFailed = document.getElementById('cardFailedCount');
  const cardStaked = document.getElementById('cardTotalStaked');
  const cardStreak = document.getElementById('cardCurrentStreak');
  const tagEl = document.getElementById('overviewUserTag');

  if (!stats) {
    if (cardActive) cardActive.textContent = '0';
    if (cardPending) cardPending.textContent = '0';
    if (cardCompleted) cardCompleted.textContent = '0';
    if (cardFailed) cardFailed.textContent = '0';
    if (cardStaked) cardStaked.textContent = '0.00 USDC';
    if (cardStreak) cardStreak.textContent = '0';
    if (tagEl) {
      tagEl.textContent = 'Guest';
      tagEl.className = 'badge-pill badge-pill-dark';
    }
    return;
  }

  if (cardActive) cardActive.textContent = stats.active_commitments ?? 0;
  if (cardPending) cardPending.textContent = stats.pending_verification ?? 0;
  if (cardCompleted) cardCompleted.textContent = stats.completed_commitments ?? 0;
  if (cardFailed) cardFailed.textContent = stats.failed_commitments ?? 0;
  if (cardStaked) cardStaked.textContent = `${Number(stats.total_staked_usdc ?? 0).toFixed(2)} USDC`;
  if (cardStreak) cardStreak.textContent = stats.current_streak ?? 0;

  if (tagEl) {
    const name = (state.auth && state.auth.profile && (state.auth.profile.display_name || state.auth.profile.username)) || 'Member';
    tagEl.textContent = `⚡ ${name}`;
    tagEl.className = 'badge-pill badge-pill-emerald';
  }
}

// -----------------------------------------------------------------------------
// 2. MY COMMITMENTS TABLE & FILTERING
// -----------------------------------------------------------------------------
async function loadMyCommitments() {
  const tbody = document.getElementById('myCommitmentsTableBody');
  if (!state.auth || !state.auth.token) {
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty-cell">🔒 Authentication required. Please sign in to inspect your commitments.</td></tr>';
    }
    return;
  }

  if (tbody && state.myCommitments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty-cell">Loading your personal commitments...</td></tr>';
  }

  try {
    const res = await fetch(`${API_BASE}/api/commitments/my`, {
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });
    if (!res.ok) throw new Error('Failed to load my commitments');
    const data = await res.json();
    state.myCommitments = data.commitments || [];
    if (data.stats) {
      state.userStats = data.stats;
      renderUserOverview(data.stats);
    }
    renderMyCommitments();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty-cell" style="color:var(--sol-rose);">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

window.filterMyCommitments = function(filter) {
  state.currentCommitmentFilter = filter;
  document.querySelectorAll('.filter-pills-row .filter-pill').forEach(btn => {
    if (btn.getAttribute('data-filter') === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderMyCommitments();
};

function renderMyCommitments() {
  const tbody = document.getElementById('myCommitmentsTableBody');
  if (!tbody) return;

  const filter = state.currentCommitmentFilter || 'ALL';
  const list = state.myCommitments.filter(c => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return c.status === 'ACTIVE' || c.status === 'FUNDED' || c.status === 'CREATED';
    if (filter === 'PENDING_VERIFICATION') return c.status === 'PENDING_VERIFICATION';
    if (filter === 'COMPLETED') return c.status === 'SETTLED' && c.settlement && c.settlement.recipientPayout === c.stakeAmount;
    if (filter === 'FAILED') return c.status === 'SETTLED' && c.settlement && c.settlement.recipientPayout < c.stakeAmount;
    if (filter === 'DISPUTED') return c.status === 'DISPUTED';
    return true;
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty-cell">
          <div class="empty-state-box" style="border:none;background:transparent;padding:24px;">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-title">No Commitments in "${filter.replace('_', ' ')}"</div>
            <div class="empty-state-desc">You do not have any commitments matching this filter criteria.</div>
            <button class="btn btn-primary btn-sm" onclick="document.querySelector('[data-tab=\\'tab-wizard\\']').click()">＋ Create New Commitment</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const isNoLoss = c.stakingMode === 'NOLOSS';
    const statusClass = c.status.toLowerCase();
    const startDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Active';
    const endDate = c.deadline ? new Date(c.deadline).toLocaleDateString() : '7 Days';

    let settlementHtml = '<span style="color:var(--text-tertiary);font-size:11px;">Pending</span>';
    if (c.status === 'SETTLED' && c.settlement) {
      const isPass = c.settlement.resultCode?.includes('PASS');
      settlementHtml = `
        <div style="display:flex;flex-direction:column;gap:2px;">
          <span style="font-weight:700;color:${isPass ? 'var(--sol-emerald)' : 'var(--sol-rose)'};font-size:12px;">
            ${isPass ? '✅ Released' : '⚠️ Penalized'}
          </span>
          <a href="https://explorer.solana.com/tx/${c.settlement.signature}?cluster=devnet" target="_blank" rel="noopener noreferrer" style="color:var(--sol-cyan);font-size:10px;font-family:var(--font-mono);">
            Explorer ↗
          </a>
        </div>
      `;
    } else if (c.status === 'DISPUTED') {
      settlementHtml = '<span style="color:var(--sol-amber);font-weight:700;font-size:11px;">⚠️ Frozen (Dispute)</span>';
    }

    return `
      <tr>
        <td>
          <div class="table-cell-title">${escapeHtml(c.title)}</div>
          <div class="table-cell-sub">ID: ${escapeHtml(c.id)}</div>
        </td>
        <td>
          <div style="font-weight:600;text-transform:capitalize;">${escapeHtml(c.verifierType || 'GitHub')}</div>
          <div class="table-cell-sub">${isNoLoss ? '🛡️ No-Loss Yield' : '🔥 Hardcore Escrow'}</div>
        </td>
        <td>
          <div style="font-weight:700;color:var(--text-primary);">${c.stakeAmount} USDC</div>
          <div class="table-cell-sub">Fee: ${c.verificationFee || '1.50'} USDC</div>
        </td>
        <td>
          <div style="font-size:12px;">${startDate} → ${endDate}</div>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${escapeHtml(c.status.replace('_', ' '))}</span>
        </td>
        <td>
          <div style="font-size:11px;max-width:180px;color:var(--text-secondary);line-height:1.3;">
            ${escapeHtml(c.failurePolicyText || c.failurePolicy || 'Partial Return')}
          </div>
        </td>
        <td>
          ${settlementHtml}
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex;gap:6px;justify-content:flex-end;">
            <button class="btn btn-outline btn-sm" onclick="openCommitmentDetailModal('${c.id}')" title="Inspect Full Terms & Verification">
              🔍 Details
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openCommitmentDetailModal('${c.id}', 'evidence')" title="Submit Cryptographic Proof">
              📤 Proof
            </button>
            ${(c.status === 'VERIFIED' || c.status === 'SETTLED' || c.status === 'PENDING_VERIFICATION') && c.status !== 'DISPUTED' ? `
              <button class="btn btn-outline btn-sm" onclick="openCommitmentDetailModal('${c.id}', 'dispute')" style="border-color:rgba(242,186,82,0.4);color:var(--sol-amber);" title="Challenge result">
                ⚖️
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// -----------------------------------------------------------------------------
// 3. MULTI-STEP CREATION WIZARD ENGINE
// -----------------------------------------------------------------------------
function setupWizard() {
  const modeCards = document.querySelectorAll('.mode-option-card');
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.getAttribute('data-mode');
      if (!mode) return;
      modeCards.forEach(c => {
        if (c.getAttribute('data-mode')) c.classList.remove('selected');
      });
      card.classList.add('selected');
      state.selectedStakingMode = mode;
      updateWizardPreview();
    });
  });

  const stakeInput = document.getElementById('wizardStake');
  const verifierSelect = document.getElementById('wizardVerifier');
  const policySelect = document.getElementById('wizardFailurePolicy');
  if (stakeInput) stakeInput.addEventListener('input', updateWizardPreview);
  if (verifierSelect) verifierSelect.addEventListener('change', updateWizardPreview);
  if (policySelect) policySelect.addEventListener('change', updateWizardPreview);

  const form = document.getElementById('commitmentWizardForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCreateCommitment();
    });
  }

  updateWizardPreview();
}

window.selectCommitmentType = function(type) {
  state.wizardType = type;
  document.querySelectorAll('[data-type-card]').forEach(card => {
    if (card.getAttribute('data-type-card') === type) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  const ghBlock = document.getElementById('criteriaGithubBlock');
  const studyBlock = document.getElementById('criteriaStudyBlock');
  const peerBlock = document.getElementById('criteriaPeerBlock');
  const verifierSelect = document.getElementById('wizardVerifier');

  if (ghBlock) ghBlock.classList.toggle('hidden', type !== 'github');
  if (studyBlock) studyBlock.classList.toggle('hidden', type !== 'study_timer');
  if (peerBlock) peerBlock.classList.toggle('hidden', type !== 'peer_consensus');

  if (verifierSelect) {
    verifierSelect.value = type;
  }

  updateWizardPreview();
};

window.goToWizardStep = function(stepNumber) {
  state.wizardStep = stepNumber;

  for (let i = 1; i <= 7; i++) {
    const pane = document.getElementById(`wizardPane${i}`);
    if (pane) {
      pane.classList.toggle('active', i === stepNumber);
    }
  }

  document.querySelectorAll('#wizardStepsBar .wizard-step-node').forEach(node => {
    const n = Number(node.getAttribute('data-step-node'));
    node.classList.remove('active', 'completed');
    if (n < stepNumber) {
      node.classList.add('completed');
    } else if (n === stepNumber) {
      node.classList.add('active');
    }
  });

  if (stepNumber === 6) {
    updateWizardReview();
  } else if (stepNumber === 7) {
    updatePreFundingConfirmation();
  }
};

window.validateGoalAndProceed = function() {
  const title = document.getElementById('wizardTitle')?.value.trim();
  if (!title || title.length < 3) {
    showToast('⚠️ Please define a clear goal (at least 3 characters)');
    return;
  }
  goToWizardStep(3);
};

function updateWizardPreview() {
  const stake = Number(document.getElementById('wizardStake')?.value) || 20;
  const isNoLoss = state.selectedStakingMode === 'NOLOSS';
  const previewBox = document.getElementById('wizardConsequencePreview');
  const policy = document.getElementById('wizardFailurePolicy')?.value || 'PARTIAL_RETURN';

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
      const destText = policy === 'EDUCATION_POOL' 
        ? 'sent to Solana Developer Education Pool'
        : policy === 'CHARITY'
          ? 'sent to GiveDirectly Charity Fund'
          : `returned (${stake - penalty} USDC back, ${penalty} USDC penalty)`;
      previewBox.innerHTML = `
        <strong>🔥 Hardcore Principal Stake:</strong><br>
        You are locking <strong>${stake} USDC</strong> in Solana Escrow PDA.<br>
        • On Success: 100% (${stake} USDC) returned to your wallet.<br>
        • On Failure: Consequence applied — ${destText}.
      `;
    }
  }
}

function updateWizardReview() {
  const card = document.getElementById('wizardReviewCard');
  if (!card) return;

  const title = document.getElementById('wizardTitle')?.value || '—';
  const type = state.wizardType || 'github';
  const verifier = document.getElementById('wizardVerifier')?.value || type;
  const stake = document.getElementById('wizardStake')?.value || 25;
  const isNoLoss = state.selectedStakingMode === 'NOLOSS';
  const policy = document.getElementById('wizardFailurePolicy')?.value || 'PARTIAL_RETURN';

  let criteriaText = '';
  if (type === 'github') {
    const repo = document.getElementById('wizardRepo')?.value || 'solana-labs/solana';
    const commits = document.getElementById('wizardRequiredCommits')?.value || 5;
    const days = document.getElementById('wizardPeriodDaysGh')?.value || 7;
    criteriaText = `Make ${commits} qualifying commits to ${repo} within ${days} days.`;
  } else if (type === 'study_timer') {
    const mins = document.getElementById('wizardStudyMins')?.value || 60;
    const days = document.getElementById('wizardStudyDays')?.value || 5;
    criteriaText = `Complete ${mins} active minutes daily across ${days} days in Commit focus studio.`;
  } else {
    const checklist = document.getElementById('wizardChecklist')?.value || 'Complete physical task & submit challenge video';
    criteriaText = `${checklist} with live Solana blockhash challenge.`;
  }

  card.innerHTML = `
    <div class="detail-section-title">🔍 Comprehensive Commitment Summary</div>
    <div class="detail-grid-2col">
      <div class="detail-param-item">
        <span class="detail-param-label">Commitment Goal</span>
        <span class="detail-param-val">${escapeHtml(title)}</span>
      </div>
      <div class="detail-param-item">
        <span class="detail-param-label">Commitment Type</span>
        <span class="detail-param-val" style="text-transform:capitalize;">${type.replace('_', ' ')}</span>
      </div>
      <div class="detail-param-item">
        <span class="detail-param-label">Financial Stake</span>
        <span class="detail-param-val">${stake} USDC</span>
      </div>
      <div class="detail-param-item">
        <span class="detail-param-label">Staking Mode</span>
        <span class="detail-param-val">${isNoLoss ? '🛡️ No-Loss Yield Vault' : '🔥 Hardcore Principal'}</span>
      </div>
      <div class="detail-param-item" style="grid-column:span 2;">
        <span class="detail-param-label">Immutable Success Criteria</span>
        <span class="detail-param-val" style="color:var(--sol-cyan);">${escapeHtml(criteriaText)}</span>
      </div>
      <div class="detail-param-item">
        <span class="detail-param-label">Assigned Oracle / Verifier</span>
        <span class="detail-param-val">${escapeHtml(verifier)}</span>
      </div>
      <div class="detail-param-item">
        <span class="detail-param-label">Failure Policy</span>
        <span class="detail-param-val">${escapeHtml(policy.replace('_', ' '))}</span>
      </div>
    </div>
  `;
}

function updatePreFundingConfirmation() {
  const title = document.getElementById('wizardTitle')?.value || 'Ship promises';
  const type = state.wizardType || 'github';
  const stake = Number(document.getElementById('wizardStake')?.value) || 25;
  const isNoLoss = state.selectedStakingMode === 'NOLOSS';
  const verifier = document.getElementById('wizardVerifier')?.value || 'github';
  const penalty = isNoLoss ? Math.round(stake * 0.08) : Math.round(stake * 0.25);

  let criteriaText = '';
  let periodText = '';
  if (type === 'github') {
    const repo = document.getElementById('wizardRepo')?.value || 'solana-labs/solana';
    const commits = document.getElementById('wizardRequiredCommits')?.value || 5;
    const days = document.getElementById('wizardPeriodDaysGh')?.value || 7;
    criteriaText = `Push ${commits} qualifying git commits to ${repo} (verified SHAs)`;
    periodText = `${days} Days from funding`;
  } else if (type === 'study_timer') {
    const mins = document.getElementById('wizardStudyMins')?.value || 60;
    const days = document.getElementById('wizardStudyDays')?.value || 5;
    criteriaText = `Active ${mins} mins/day for ${days} days (cryptographic heartbeats & nonces)`;
    periodText = `${days} Days from funding`;
  } else {
    const checklist = document.getElementById('wizardChecklist')?.value || 'Physical task requirements verified';
    const days = document.getElementById('wizardPeriodDaysPeer')?.value || 3;
    criteriaText = `${checklist} (stamped with Solana blockhash challenge)`;
    periodText = `${days} Days from funding`;
  }

  const successText = isNoLoss 
    ? `100% principal (${stake} USDC) + Kamino yield returned to wallet`
    : `100% stake (${stake} USDC) released to your wallet`;

  const failedText = isNoLoss
    ? `Principal safe, ~${penalty} USDC accrued yield forfeited`
    : `${stake - penalty} USDC returned, ${penalty} USDC sent to consequence pool`;

  const elGoal = document.getElementById('confirmGoalDisplay');
  const elStake = document.getElementById('confirmStakeDisplay');
  const elPeriod = document.getElementById('confirmPeriodDisplay');
  const elCond = document.getElementById('confirmConditionDisplay');
  const elSucc = document.getElementById('confirmSuccessDisplay');
  const elFail = document.getElementById('confirmFailedDisplay');
  const elVerif = document.getElementById('confirmVerifierDisplay');
  const chk = document.getElementById('chkConfirmRules');

  if (elGoal) elGoal.textContent = title;
  if (elStake) elStake.textContent = `${stake} USDC`;
  if (elPeriod) elPeriod.textContent = periodText;
  if (elCond) elCond.textContent = criteriaText;
  if (elSucc) elSucc.textContent = successText;
  if (elFail) elFail.textContent = failedText;
  if (elVerif) elVerif.textContent = verifier.toUpperCase();
  if (chk) chk.checked = false;
}

async function handleCreateCommitment() {
  if (!state.auth || !state.auth.token) {
    openAuthModal('signin');
    return;
  }

  const chk = document.getElementById('chkConfirmRules');
  if (chk && !chk.checked) {
    showToast('⚠️ You must accept the immutable commitment rules before funding.');
    return;
  }

  const title = document.getElementById('wizardTitle')?.value.trim();
  const verifierType = document.getElementById('wizardVerifier')?.value || 'github';
  const stakeAmount = Number(document.getElementById('wizardStake')?.value) || 25;
  const isNoLoss = state.selectedStakingMode === 'NOLOSS';
  const penaltyAmount = isNoLoss ? Math.round(stakeAmount * 0.08) : Math.round(stakeAmount * 0.25);
  const failurePolicy = document.getElementById('wizardFailurePolicy')?.value || 'PARTIAL_RETURN';

  const type = state.wizardType || 'github';
  const details = {
    type,
    auth_user_id: state.auth.user?.id
  };

  if (type === 'github') {
    const repoStr = document.getElementById('wizardRepo')?.value.trim() || 'solana-labs/solana';
    const [owner, name] = repoStr.includes('/') ? repoStr.split('/') : ['solana-labs', 'solana'];
    details.repoOwner = owner;
    details.repoName = name;
    details.authorUsername = document.getElementById('wizardGhUser')?.value.trim() || 'solana-builder';
    details.requiredCommits = Number(document.getElementById('wizardRequiredCommits')?.value) || 5;
    details.durationDays = Number(document.getElementById('wizardPeriodDaysGh')?.value) || 7;
  } else if (type === 'study_timer') {
    details.requiredMinutes = Number(document.getElementById('wizardStudyMins')?.value) || 60;
    details.requiredDays = Number(document.getElementById('wizardStudyDays')?.value) || 5;
  } else {
    details.checklist = document.getElementById('wizardChecklist')?.value.trim() || 'Physical task verified';
    details.deadlineDays = Number(document.getElementById('wizardPeriodDaysPeer')?.value) || 3;
    details.challengeCode = 'SOL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  const failurePolicyText = isNoLoss 
    ? `Principal safe, ~${penaltyAmount} USDC yield forfeited`
    : failurePolicy === 'EDUCATION_POOL' 
      ? `0 USDC returned, ${stakeAmount} USDC to Developer Education Pool`
      : failurePolicy === 'CHARITY'
        ? `${stakeAmount - penaltyAmount} USDC back, ${penaltyAmount} USDC to Charity Pool`
        : `${stakeAmount - penaltyAmount} USDC back, ${penaltyAmount} USDC penalty`;

  const payload = {
    title,
    creator: (state.auth && state.auth.profile && state.auth.profile.wallet_address) || state.wallet.address,
    stakingMode: state.selectedStakingMode,
    stakeAmount,
    penaltyAmount,
    verificationFee: 1.5,
    verifierType,
    failurePolicy,
    failurePolicyText,
    details
  };

  const btnFund = document.getElementById('btnConfirmAndFund');
  if (btnFund) {
    btnFund.disabled = true;
    btnFund.textContent = '⏳ Waiting for Solana Escrow PDA...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/commitments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create commitment');
    }

    const newCommitment = await res.json();

    if (btnFund) btnFund.textContent = '🔒 Locking USDC in Escrow...';

    // Fund on Solana
    await fetch(`${API_BASE}/api/commitments/${newCommitment.id}/fund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });

    state.wallet.balanceUsdc -= stakeAmount + 1.5;
    updateWalletDisplay();

    showToast(`🎉 Commitment "${newCommitment.id}" Funded & Activated in Solana Escrow!`);

    // Reset wizard
    goToWizardStep(1);
    const form = document.getElementById('commitmentWizardForm');
    if (form) form.reset();

    // Refresh all data
    await loadCommitments();
    await loadUserOverview();
    await loadMyCommitments();
    await loadNotifications();

    // Switch to My Commitments
    const myTabBtn = document.getElementById('navTabMyCommitments');
    if (myTabBtn) myTabBtn.click();
  } catch (err) {
    showToast(`Transaction Failed: ${err.message}`);
  } finally {
    if (btnFund) {
      btnFund.disabled = false;
      btnFund.textContent = '🔒 Confirm & Fund with Solana Escrow';
    }
  }
}

// -----------------------------------------------------------------------------
// 4. USER PROFILE & REPUTATION
// -----------------------------------------------------------------------------
function loadUserProfile() {
  if (!state.auth || !state.auth.profile) return;
  const p = state.auth.profile;
  const stats = state.userStats || state.auth.stats || {};

  const nameInput = document.getElementById('profileDisplayNameInput');
  const userInput = document.getElementById('profileUsernameInput');
  const emailInput = document.getElementById('profileEmailInput');
  const walletInput = document.getElementById('profileWalletInput');
  const initialEl = document.getElementById('profileAvatarInitial');
  const nameHead = document.getElementById('profileDisplayNameHead');
  const userHead = document.getElementById('profileUsernameHead');
  const roleBadge = document.getElementById('profileRoleBadge');

  if (nameInput) nameInput.value = p.display_name || '';
  if (userInput) userInput.value = `@${p.username || ''}`;
  if (emailInput) emailInput.value = state.auth.user?.email || '';
  if (walletInput) walletInput.value = p.wallet_address || 'No wallet linked';
  if (nameHead) nameHead.textContent = p.display_name || 'User';
  if (userHead) userHead.textContent = `@${p.username || 'username'}`;
  if (initialEl) initialEl.textContent = (p.display_name || p.username || 'U').charAt(0).toUpperCase();

  if (roleBadge) {
    roleBadge.textContent = p.role || 'USER';
    roleBadge.className = `role-pill ${p.role === 'ADMIN' ? 'role-admin' : p.role === 'VERIFIER' ? 'role-verifier' : 'role-user'}`;
  }

  // Authoritative system-generated statistics
  const total = stats.total_commitments ?? stats.commitments_count ?? 0;
  const succ = stats.successful_commitments ?? stats.successful_count ?? 0;
  const fail = stats.failed_commitments ?? stats.failed_count ?? 0;
  const rate = stats.success_rate ?? (total > 0 ? ((succ / total) * 100).toFixed(1) : 100);
  const streak = stats.current_streak ?? 0;
  const staked = stats.total_staked_usdc ?? 0;

  const elTot = document.getElementById('profTotalCommitments');
  const elSucc = document.getElementById('profSuccessfulCommitments');
  const elFail = document.getElementById('profFailedCommitments');
  const elRate = document.getElementById('profSuccessRate');
  const elStrk = document.getElementById('profCurrentStreak');
  const elStkd = document.getElementById('profTotalCommitted');

  if (elTot) elTot.textContent = total;
  if (elSucc) elSucc.textContent = succ;
  if (elFail) elFail.textContent = fail;
  if (elRate) elRate.textContent = `${rate}%`;
  if (elStrk) elStrk.textContent = streak;
  if (elStkd) elStkd.textContent = `${Number(staked).toFixed(2)} USDC`;
}

window.handleSaveProfile = async function(e) {
  e.preventDefault();
  if (!state.auth || !state.auth.token) return;

  const btn = document.getElementById('btnSaveProfile');
  const displayName = document.getElementById('profileDisplayNameInput')?.value.trim();

  if (!displayName || displayName.length < 2) {
    showToast('Display name must be at least 2 characters');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({ displayName })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');

    state.auth.profile = data.profile;
    updateAuthUI();
    loadUserProfile();
    showToast('Profile updated successfully!');
  } catch (err) {
    showToast(`Error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 Save Profile Changes';
    }
  }
};

// -----------------------------------------------------------------------------
// 5. NOTIFICATIONS DRAWER
// -----------------------------------------------------------------------------
window.toggleNotificationsDrawer = async function() {
  const drawer = document.getElementById('notificationsDrawer');
  const overlay = document.getElementById('notificationsOverlay');
  if (!drawer || !overlay) return;

  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    drawer.classList.add('open');
    overlay.classList.add('open');
    await loadNotifications();
  }
};

async function loadNotifications() {
  if (!state.auth || !state.auth.token) {
    updateNotificationBadges(0);
    renderNotifications([]);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/notifications`, {
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });
    if (!res.ok) throw new Error('Failed to load notifications');
    const data = await res.json();
    state.notifications = data.notifications || [];
    state.unreadNotifsCount = data.unreadCount || 0;
    updateNotificationBadges(state.unreadNotifsCount);
    renderNotifications(state.notifications);
  } catch (err) {
    console.warn('[Notifications Error]:', err);
  }
}

function updateNotificationBadges(unreadCount) {
  const badge = document.getElementById('notifBadge');
  const drawerCount = document.getElementById('drawerUnreadCount');

  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.textContent = '0';
      badge.classList.add('hidden');
    }
  }

  if (drawerCount) {
    drawerCount.textContent = `${unreadCount} Unread`;
  }
}

function renderNotifications(notifs) {
  const container = document.getElementById('notificationsList');
  if (!container) return;

  if (!notifs || notifs.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box" style="padding:24px 12px;border:none;">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No Notifications</div>
        <div class="empty-state-desc">You are all caught up on your commitments.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = notifs.map(n => {
    const isUnread = !n.read;
    const timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="notif-item ${isUnread ? 'unread' : ''}" onclick="markNotificationRead('${n.id}')">
        <div class="notif-item-top">
          <span class="notif-item-title">${escapeHtml(n.title)}</span>
          <span class="notif-item-time">${timeStr}</span>
        </div>
        <div class="notif-item-msg">${escapeHtml(n.message)}</div>
      </div>
    `;
  }).join('');
}

window.markNotificationRead = async function(id) {
  if (!state.auth || !state.auth.token) return;
  try {
    await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });
    await loadNotifications();
  } catch (_) {}
};

window.markAllNotificationsRead = async function() {
  if (!state.auth || !state.auth.token) return;
  try {
    await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });
    await loadNotifications();
    showToast('All notifications marked as read.');
  } catch (_) {}
};

// -----------------------------------------------------------------------------
// 6. COMMITMENT DETAIL MODAL, EVIDENCE & DISPUTES
// -----------------------------------------------------------------------------
window.openCommitmentDetailModal = async function(id, focusSection = null) {
  const modal = document.getElementById('commitmentDetailModal');
  const body = document.getElementById('detailModalBody');
  const titleEl = document.getElementById('detailModalTitle');
  const badgeEl = document.getElementById('detailModalStatusBadge');
  if (!modal || !body) return;

  modal.classList.add('open');
  body.innerHTML = '<div style="padding:2rem;text-align:center;">Loading commitment details from Solana & Supabase...</div>';

  try {
    const headers = {};
    if (state.auth && state.auth.token) {
      headers['Authorization'] = `Bearer ${state.auth.token}`;
    }
    const res = await fetch(`${API_BASE}/api/commitments/${id}`, { headers });
    if (!res.ok) throw new Error('Commitment not found or access restricted');
    const c = await res.json();

    if (titleEl) titleEl.textContent = c.title;
    if (badgeEl) {
      badgeEl.textContent = c.status.replace('_', ' ');
      badgeEl.className = `status-badge ${c.status.toLowerCase()}`;
    }

    const isNoLoss = c.stakingMode === 'NOLOSS';
    const isOwner = Boolean(state.auth && state.auth.user && (c.auth_user_id === state.auth.user.id || (c.details && c.details.auth_user_id === state.auth.user.id)));
    const evidenceList = Array.isArray(c.evidence) ? c.evidence : [];

    let criteriaText = '';
    let metricProgressHtml = '';
    if (c.verifierType === 'github') {
      const required = c.details?.requiredCommits || 5;
      const verified = c.verifiedMetric || 0;
      const pct = Math.min(100, Math.round((verified / required) * 100));
      criteriaText = `Push ${required} qualifying commits to ${c.details?.repoOwner || 'solana-labs'}/${c.details?.repoName || 'solana'} authored by @${c.details?.authorUsername || 'solana-builder'}`;
      metricProgressHtml = `
        <div style="margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">
            <span>Qualifying Commits</span>
            <span>${verified} / ${required} (${pct}%)</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
        </div>
      `;
    } else if (c.verifierType === 'study_timer') {
      const required = c.details?.requiredMinutes || 60;
      const verified = c.verifiedMetric || 0;
      const pct = Math.min(100, Math.round((verified / required) * 100));
      criteriaText = `Active study sessions performed through the Commit focus environment. (Validates cryptographic nonces)`;
      metricProgressHtml = `
        <div style="margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">
            <span>Verified Study Time</span>
            <span>${verified} / ${required} Mins (${pct}%)</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
        </div>
      `;
    } else {
      criteriaText = c.details?.checklist || 'Real-world physical task completion stamped with live Solana blockhash challenge';
      metricProgressHtml = `
        <div style="margin-top:10px;font-size:12px;color:var(--text-secondary);">
          Dynamic Challenge Code: <strong style="color:var(--sol-cyan);font-family:var(--font-mono);">${c.details?.challengeCode || 'SOL-BLOCKHASH'}</strong>
        </div>
      `;
    }

    body.innerHTML = `
      <!-- FINANCIAL COMMITMENT & CONSEQUENCES -->
      <div class="detail-section-card">
        <div class="detail-section-title">💰 Financial Commitment & Rules</div>
        <div class="detail-grid-2col">
          <div class="detail-param-item">
            <span class="detail-param-label">Locked Stake</span>
            <span class="detail-param-val">${c.stakeAmount} USDC</span>
          </div>
          <div class="detail-param-item">
            <span class="detail-param-label">Staking Mode</span>
            <span class="detail-param-val">${isNoLoss ? '🛡️ No-Loss Yield Vault' : '🔥 Hardcore Principal'}</span>
          </div>
          <div class="detail-param-item">
            <span class="detail-param-label">Verifier Network Fee</span>
            <span class="detail-param-val">${c.verificationFee || 1.50} USDC</span>
          </div>
          <div class="detail-param-item">
            <span class="detail-param-label">Settlement Destination</span>
            <span class="detail-param-val" style="font-family:var(--font-mono);font-size:11px;">
              ${c.creator ? c.creator.slice(0, 6) + '...' + c.creator.slice(-4) : 'Escrow PDA'}
            </span>
          </div>
          <div class="detail-param-item" style="grid-column: span 2;">
            <span class="detail-param-label">Pre-Funded Consequence Policy</span>
            <span class="detail-param-val" style="color:var(--sol-amber);font-size:12px;">
              ${escapeHtml(c.failurePolicyText || c.failurePolicy || 'Partial Return')}
            </span>
          </div>
        </div>
      </div>

      <!-- SUCCESS CRITERIA & TIMELINE -->
      <div class="detail-section-card">
        <div class="detail-section-title">🎯 Immutable Success Criteria & Verification</div>
        <div style="font-size:13px;line-height:1.4;margin-bottom:8px;color:var(--text-primary);">
          ${escapeHtml(criteriaText)}
        </div>
        ${metricProgressHtml}
        <div class="detail-grid-2col" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle);">
          <div class="detail-param-item">
            <span class="detail-param-label">Oracle / Verifier Type</span>
            <span class="detail-param-val" style="text-transform:capitalize;">${escapeHtml(c.verifierType)}</span>
          </div>
          <div class="detail-param-item">
            <span class="detail-param-label">Verification Result</span>
            <span class="detail-param-val" style="color:${c.status === 'SETTLED' ? 'var(--sol-emerald)' : 'var(--text-primary)'};">
              ${c.attestation ? c.attestation.resultCode : c.status}
            </span>
          </div>
        </div>
      </div>

      <!-- OFF-CHAIN CRYPTOGRAPHIC EVIDENCE VAULT -->
      <div class="detail-section-card" id="modalEvidenceSection">
        <div class="detail-section-title">🗄️ Cryptographic Evidence Vault (Off-Chain)</div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">
          Evidence is held securely off-chain. Only the cryptographic SHA-256 integrity hash is recorded on Solana.
        </p>

        <!-- Existing Evidence List -->
        <div id="modalEvidenceList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
          ${evidenceList.length === 0 ? `
            <div style="font-size:12px;color:var(--text-tertiary);font-style:italic;">No evidence submitted yet.</div>
          ` : evidenceList.map((ev, idx) => `
            <div style="background:var(--surface-l3);border:1px solid var(--border-subtle);border-radius:8px;padding:10px 12px;font-size:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-weight:700;color:var(--sol-cyan);">#${idx + 1} ${escapeHtml(ev.type || 'DOCUMENT')}</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);">${new Date(ev.submitted_at || Date.now()).toLocaleTimeString()}</span>
              </div>
              <div style="color:var(--text-primary);margin-bottom:4px;">${escapeHtml(ev.description || ev.content || 'Proof submitted')}</div>
              <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);word-break:break-all;">
                SHA-256 Hash: <span style="color:var(--sol-emerald);">${escapeHtml(ev.hash || '—')}</span>
              </div>
            </div>
          `).join('')}
        </div>

        ${isOwner && c.status !== 'SETTLED' ? `
          <!-- Evidence Submission Form -->
          <form onsubmit="handleEvidenceSubmit(event, '${c.id}')" style="background:var(--surface-l3);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;">
            <div style="font-size:12px;font-weight:700;">Submit Additional Evidence</div>
            <div class="form-grid-2col" style="gap:8px;">
              <div>
                <label class="form-label form-label-sm">Evidence Type</label>
                <select id="evidenceTypeInput" class="form-select form-select-sm">
                  <option value="SCREENSHOT">Screenshot / Image</option>
                  <option value="VIDEO">Video Recording</option>
                  <option value="DOCUMENT">Document / PDF</option>
                  <option value="CHECKIN">Location / Check-in</option>
                  <option value="OTHER">Other Verification Log</option>
                </select>
              </div>
              <div>
                <label class="form-label form-label-sm">Evidence URL or Content</label>
                <input type="text" id="evidenceContentInput" class="form-input form-input-sm" required placeholder="https://... or log data">
              </div>
            </div>
            <div>
              <label class="form-label form-label-sm">Description & Notes</label>
              <input type="text" id="evidenceDescInput" class="form-input form-input-sm" placeholder="e.g. Video proof displaying dynamic blockhash challenge code">
            </div>
            <button type="submit" class="btn btn-primary btn-sm" id="btnSubmitEvidence" style="align-self:flex-start;">
              🔐 Hash & Upload Evidence
            </button>
          </form>
        ` : ''}
      </div>

      <!-- DISPUTE RESOLUTION CENTER -->
      <div class="detail-section-card" id="modalDisputeSection">
        <div class="detail-section-title">⚖️ Dispute Resolution Center</div>
        ${c.status === 'DISPUTED' ? `
          <div style="border:1px solid rgba(242,186,82,0.4);background:rgba(242,186,82,0.08);border-radius:8px;padding:12px;font-size:12px;">
            <strong style="color:var(--sol-amber);">⚠️ Active Dispute: Under Peer Consensus Review</strong>
            <p style="margin-top:4px;color:var(--text-secondary);">
              Settlement has been frozen. Normal settlement cannot proceed until independent verifiers resolve the dispute.
            </p>
            <div style="margin-top:6px;font-size:11px;">
              <strong>Dispute Reason:</strong> ${escapeHtml(c.disputeReason || 'Contested verification evaluation')}
            </div>
          </div>
        ` : isOwner && (c.status === 'VERIFIED' || c.status === 'PENDING_VERIFICATION' || c.status === 'ACTIVE') ? `
          <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">
            If you believe the oracle or verifier made an error, you may challenge the evaluation. Opening a dispute halts automated settlement and transfers review to peer consensus.
          </p>
          <div style="display:flex;gap:8px;">
            <input type="text" id="disputeReasonInput" class="form-input form-input-sm" placeholder="Provide factual reason for dispute...">
            <button type="button" class="btn btn-secondary btn-sm" onclick="handleOpenDispute('${c.id}')" style="white-space:nowrap;border-color:var(--sol-amber);color:var(--sol-amber);">
              ⚖️ Open Dispute
            </button>
          </div>
        ` : `
          <div style="font-size:12px;color:var(--text-tertiary);">No active disputes for this commitment.</div>
        `}
      </div>
    `;

    if (focusSection === 'evidence') {
      const el = document.getElementById('modalEvidenceSection');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (focusSection === 'dispute') {
      const el = document.getElementById('modalDisputeSection');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    body.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--sol-rose);">Error: ${escapeHtml(err.message)}</div>`;
  }
};

window.closeCommitmentDetailModal = function() {
  const modal = document.getElementById('commitmentDetailModal');
  if (modal) modal.classList.remove('open');
};

window.handleEvidenceSubmit = async function(e, id) {
  e.preventDefault();
  if (!state.auth || !state.auth.token) return;

  const btn = document.getElementById('btnSubmitEvidence');
  const type = document.getElementById('evidenceTypeInput')?.value;
  const content = document.getElementById('evidenceContentInput')?.value.trim();
  const description = document.getElementById('evidenceDescInput')?.value.trim();

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Hashing (SHA-256)...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/commitments/${id}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({ type, content, description })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit evidence');

    showToast(`✅ Evidence submitted & SHA-256 hashed! (${data.hash.slice(0, 12)}...)`);
    await openCommitmentDetailModal(id, 'evidence');
    await loadNotifications();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔐 Hash & Upload Evidence';
    }
  }
};

window.handleOpenDispute = async function(id) {
  if (!state.auth || !state.auth.token) return;
  const reason = document.getElementById('disputeReasonInput')?.value.trim();
  if (!reason || reason.length < 5) {
    showToast('⚠️ Please provide a detailed reason for the dispute (at least 5 chars)');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/commitments/${id}/dispute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({ reason })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to open dispute');

    showToast('⚖️ Dispute opened! Settlement is now frozen pending peer consensus.');
    await openCommitmentDetailModal(id, 'dispute');
    await loadMyCommitments();
    await loadUserOverview();
    await loadNotifications();
  } catch (err) {
    showToast(`Dispute error: ${err.message}`);
  }
};

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
  if (token) {
    state.auth.token = token;
  }
  updateAuthUI();

  if (!token) {
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

      await loadUserOverview();
      await loadNotifications();
      if (state.activeTab === 'tab-my-commitments') {
        await loadMyCommitments();
      } else if (state.activeTab === 'tab-profile') {
        loadUserProfile();
      }
    } else {
      localStorage.removeItem('commit_token');
      state.auth.token = null;
      state.auth.user = null;
      state.auth.profile = null;
      renderUserOverview(null);
    }
  } catch (err) {
    console.warn('[Auth Init] Error connecting to auth server:', err);
  }

  updateAuthUI();
}

function updateAuthUI() {
  const section = document.getElementById('authHeaderSection');
  const adminTab = document.getElementById('navTabAdmin');

  // Toggle Wizard Locked Card vs Active Form Card
  const wizardAuthCard = document.getElementById('wizardAuthRequiredCard');
  const wizardFormCard = document.getElementById('wizardFormCard');
  const isLoggedIn = Boolean(state.auth && state.auth.token);

  if (wizardAuthCard && wizardFormCard) {
    if (isLoggedIn) {
      wizardAuthCard.classList.add('hidden');
      wizardAuthCard.style.display = 'none';
      wizardFormCard.classList.remove('hidden');
      wizardFormCard.style.display = 'block';
    } else {
      wizardAuthCard.classList.remove('hidden');
      wizardAuthCard.style.display = 'block';
      wizardFormCard.classList.add('hidden');
      wizardFormCard.style.display = 'none';
    }
  }

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

    await loadUserOverview();
    await loadNotifications();
    await loadMyCommitments();
    loadUserProfile();

    if (state.pendingTab) {
      const targetBtn = document.querySelector(`[data-tab="${state.pendingTab}"]`);
      if (targetBtn) targetBtn.click();
      state.pendingTab = null;
    }
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

    await loadUserOverview();
    await loadNotifications();
    await loadMyCommitments();
    loadUserProfile();

    if (state.pendingTab) {
      const targetBtn = document.querySelector(`[data-tab="${state.pendingTab}"]`);
      if (targetBtn) targetBtn.click();
      state.pendingTab = null;
    }
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
  state.myCommitments = [];
  state.notifications = [];
  state.unreadNotifsCount = 0;
  state.userStats = null;
  updateAuthUI();
  renderUserOverview(null);
  renderMyCommitments();
  renderNotifications([]);
  updateNotificationBadges(0);
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

// Initialized via startApp() above

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

// =============================================================================
// AUTHORITATIVE VERIFIER PORTAL CLIENT ENGINE
// =============================================================================

let currentVerifierActiveRequest = null;
let currentCheckinQrToken = null;
let checkinCountdownInterval = null;

async function loadVerifierDashboardData() {
  const onboardingSec = document.getElementById('verifierOnboardingSection');
  const portalMain = document.getElementById('verifierPortalMain');

  if (!state.auth || !state.auth.token) {
    if (onboardingSec) onboardingSec.style.display = 'block';
    if (portalMain) portalMain.style.display = 'block';

    try {
      const pRes = await fetch(`${API_BASE}/api/verifier/profile?id=v_alex`);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.profile) {
          const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
          setTxt('vProfileName', pData.profile.displayName);
          setTxt('vProfileBio', pData.profile.bio);
          setTxt('vStatCompleted', pData.stats.completed);
          setTxt('vStatAccuracy', `${pData.stats.accuracy.toFixed(2)}%`);
          setTxt('vStatTotalEarned', `${pData.stats.totalEarnedUSDC.toFixed(2)} USDC`);
          setTxt('vStatRating', `${pData.stats.rating.toFixed(1)} / 5.0`);
        }
      }
    } catch (_) {}
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/verifier/dashboard`, {
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });

    if (res.status === 403) {
      // User has not applied or is pending
      if (onboardingSec) onboardingSec.style.display = 'block';
      if (portalMain) portalMain.style.display = 'block';
      return;
    }

    if (!res.ok) throw new Error('Failed to load verifier dashboard');
    const data = await res.json();

    if (onboardingSec) onboardingSec.style.display = 'none';
    if (portalMain) portalMain.style.display = 'block';

    // 1. Populate Profile Header
    if (data.profile) {
      const p = data.profile;
      const avatarEl = document.getElementById('vProfileAvatar');
      const nameEl = document.getElementById('vProfileName');
      const badgeEl = document.getElementById('vProfileStatusBadge');
      const bioEl = document.getElementById('vProfileBio');
      const availEl = document.getElementById('vAvailabilitySelect');

      if (avatarEl && p.profileImage) avatarEl.src = p.profileImage;
      if (nameEl) nameEl.textContent = p.displayName || 'Verifier';
      if (badgeEl) {
        badgeEl.textContent = `${p.verificationStatus} VERIFIER`;
        badgeEl.className = p.verificationStatus === 'TRUSTED' ? 'badge-pill badge-expert' : 'badge-pill badge-pill-emerald';
      }
      if (bioEl) bioEl.textContent = p.bio || 'Verified Commit Verifier';
      if (availEl && p.availability) availEl.value = p.availability;
    }

    // 2. Populate 8-Card Authoritative Metrics
    if (data.stats) {
      const s = data.stats;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setVal('vStatPendingRequests', s.pendingRequestsCount ?? 0);
      setVal('vStatActiveTasks', s.activeCount ?? 0);
      setVal('vStatCompleted', s.completedCount ?? 0);
      setVal('vStatTotalEarned', `${(s.totalEarnedUSDC ?? 0).toFixed(2)} USDC`);
      setVal('vStatPendingRewards', `${(s.pendingRewardsUSDC ?? 0).toFixed(2)} USDC`);
      setVal('vStatAccuracy', `${(s.accuracyPercent ?? 100).toFixed(2)}%`);
      setVal('vStatDisputes', s.disputesCount ?? 0);
      setVal('vStatRating', `${(s.rating ?? 5.0).toFixed(1)} / 5.0`);
      setVal('vBadgeTotalEarned', `${(s.totalEarnedUSDC ?? 0).toFixed(2)} USDC Total`);
    }

    // 3. Render Incoming Requests Table
    renderVerifierRequestsTable(data.requests || []);

    // 4. Render Active Task (if any)
    const activeTasks = data.active || [];
    if (activeTasks.length > 0) {
      currentVerifierActiveRequest = activeTasks[0];
      renderActiveWorkspace(currentVerifierActiveRequest);
    } else if (data.requests && data.requests.length > 0) {
      // Show first request as preview
      renderActiveWorkspacePreview(data.requests[0]);
    }

    // 5. Render Earnings
    renderVerifierEarningsTable(data.earnings || []);

    // 6. Render Reputation Stream
    renderVerifierReputationTable(data.reputationEvents || []);

  } catch (err) {
    console.warn('[Verifier Portal Error]', err.message);
  }
}

function renderVerifierRequestsTable(requests) {
  const tbody = document.getElementById('vRequestsTableBody');
  const countBadge = document.getElementById('vBadgeRequestsCount');
  if (countBadge) countBadge.textContent = `${requests.length} requests`;
  if (!tbody) return;

  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty-cell">No pending verification requests available right now.</td></tr>';
    return;
  }

  tbody.innerHTML = requests.map(r => `
    <tr>
      <td>
        <div style="font-weight:700;color:var(--text-primary);">${escapeHtml(r.task_summary || 'Task')}</div>
        <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(r.commitment_id)}</div>
      </td>
      <td style="color:var(--sol-cyan);font-weight:700;">${(r.stake || 0).toFixed(2)} USDC</td>
      <td style="color:var(--sol-emerald);font-weight:700;">+${(r.verifier_fee || 1.50).toFixed(2)} USDC</td>
      <td style="font-size:12px;color:var(--text-secondary);">${escapeHtml(r.location_requirement?.address || 'Remote / Flexible')}</td>
      <td style="font-size:11px;color:var(--text-muted);">${new Date(r.deadline).toLocaleDateString()}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="handleAcceptVerifierRequest('${r.id}')">Accept</button>
          <button class="btn btn-outline btn-sm" onclick="openDeclineModal('${r.id}')" style="border-color:rgba(255,75,58,0.4);color:var(--sol-rose);">Decline</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderActiveWorkspace(task) {
  if (!task) return;
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('vActiveTaskTitle', `Active Verification: ${task.task_summary || 'Physical Task'}`);
  setTxt('vActiveTaskId', task.commitment_id);
  setTxt('vActiveTaskStake', `${(task.stake || 0).toFixed(2)} USDC`);
  setTxt('vActiveTaskReward', `${(task.verifier_fee || 1.50).toFixed(2)} USDC`);
  setTxt('vActiveTaskLocation', task.location_requirement?.address || 'Remote / Specified site');
  setTxt('vActiveTaskDeadline', new Date(task.deadline).toLocaleDateString());

  const badge = document.getElementById('vCheckinStatusBadge');
  if (badge) {
    if (task.checkin && task.checkin.verifiedAt) {
      badge.textContent = 'CHECKED IN (GPS & Timestamp Verified)';
      badge.className = 'badge-pill badge-pill-emerald';
    } else {
      badge.textContent = 'AWAITING CHECK-IN';
      badge.className = 'badge-pill badge-pill-dark';
    }
  }

  // Render locked checklist checkboxes
  const clContainer = document.getElementById('vChecklistItemsContainer');
  if (clContainer && Array.isArray(task.checklist)) {
    clContainer.innerHTML = task.checklist.map((item, idx) => `
      <label style="display:flex;align-items:center;gap:10px;font-size:12px;cursor:pointer;background:rgba(255,255,255,0.02);padding:6px 10px;border-radius:6px;">
        <input type="checkbox" id="vChkItem_${item.id || idx}" data-item-id="${item.id}" class="v-chk-item" ${item.checked ? 'checked' : ''} />
        <span>${escapeHtml(item.label)} ${item.required ? '<strong style="color:var(--sol-rose);">(Required)</strong>' : ''}</span>
      </label>
    `).join('');
  }
}

function renderActiveWorkspacePreview(request) {
  renderActiveWorkspace(request);
}

function renderVerifierEarningsTable(earnings) {
  const tbody = document.getElementById('vEarningsTableBody');
  if (!tbody) return;

  if (earnings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty-cell">No verification rewards recorded yet. Complete tasks to earn USDC.</td></tr>';
    return;
  }

  tbody.innerHTML = earnings.map(e => `
    <tr>
      <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${new Date(e.timestamp).toLocaleDateString()}</td>
      <td style="font-weight:700;font-family:var(--font-mono);">${escapeHtml(e.commitmentId)}</td>
      <td style="color:var(--sol-emerald);font-weight:800;">+${(e.amount || 0).toFixed(2)} USDC</td>
      <td>
        <span class="badge-pill ${e.status === 'SETTLED' ? 'badge-pill-emerald' : 'badge-pill-dark'}">${escapeHtml(e.status)}</span>
      </td>
      <td>
        ${e.txSignature ? `<a href="${e.explorerUrl || '#'}" target="_blank" style="color:var(--sol-cyan);font-family:var(--font-mono);font-size:11px;">${escapeHtml(e.txSignature.slice(0, 16))}... ↗</a>` : '<span style="color:var(--text-muted);font-size:11px;">Pending Settlement</span>'}
      </td>
    </tr>
  `).join('');
}

function renderVerifierReputationTable(events) {
  const tbody = document.getElementById('vReputationTableBody');
  if (!tbody) return;

  if (events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty-cell">No reputation events logged.</td></tr>';
    return;
  }

  tbody.innerHTML = events.map(ev => `
    <tr>
      <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${new Date(ev.timestamp).toLocaleString()}</td>
      <td><span style="font-weight:700;color:var(--sol-cyan);">${escapeHtml(ev.eventType)}</span></td>
      <td style="font-family:var(--font-mono);font-size:11px;">${escapeHtml(ev.commitmentId || 'N/A')}</td>
      <td style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(ev.actorId || 'SYSTEM')}</td>
      <td style="font-size:11px;color:#cbd5e1;max-width:260px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(JSON.stringify(ev.metadata || {}))}</td>
    </tr>
  `).join('');
}

window.switchVerifierSubTab = function(subTab) {
  const tabs = ['requests', 'active', 'earnings', 'reputation'];
  tabs.forEach(t => {
    const btn = document.getElementById(`btnSubTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const view = document.getElementById(`vSubView${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.className = t === subTab ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
    if (view) view.style.display = t === subTab ? 'block' : 'none';
  });
};

window.handleAcceptVerifierRequest = async function(requestId) {
  if (!state.auth || !state.auth.token) {
    openAuthModal('signin');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/verifier/requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Verification request accepted! Switched to Active Workspace.');
    await loadVerifierDashboardData();
    switchVerifierSubTab('active');
  } catch (err) {
    showToast(`Error accepting request: ${err.message}`);
  }
};

window.openDeclineModal = function(requestId) {
  const modal = document.getElementById('modalDeclineReason');
  const input = document.getElementById('declineTargetRequestId');
  if (input) input.value = requestId;
  if (modal) modal.classList.remove('hidden');
};

window.closeDeclineModal = function() {
  const modal = document.getElementById('modalDeclineReason');
  if (modal) modal.classList.add('hidden');
};

window.handleConfirmDeclineRequest = async function(e) {
  e.preventDefault();
  const requestId = document.getElementById('declineTargetRequestId')?.value;
  const reason = document.getElementById('declineReasonSelect')?.value;
  if (!requestId) return;

  try {
    const res = await fetch(`${API_BASE}/api/verifier/requests/${requestId}/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeDeclineModal();
    showToast('Verification request declined without penalty.');
    await loadVerifierDashboardData();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
};

window.handleGenerateCheckinQR = async function() {
  if (!currentVerifierActiveRequest) {
    showToast('No active verification task selected');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/verifier/checkin/qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({ requestId: currentVerifierActiveRequest.id })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentCheckinQrToken = data.qrToken;
    const qrDisplay = document.getElementById('vQrCodeDisplay');
    const timerDisplay = document.getElementById('vQrTimer');
    if (qrDisplay) qrDisplay.textContent = data.formattedCode || `CHECKIN-${data.qrToken.slice(0, 10).toUpperCase()}`;

    // Start 5-minute countdown timer
    let remainingSec = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
    if (checkinCountdownInterval) clearInterval(checkinCountdownInterval);

    checkinCountdownInterval = setInterval(() => {
      remainingSec--;
      if (remainingSec <= 0) {
        clearInterval(checkinCountdownInterval);
        if (timerDisplay) timerDisplay.textContent = 'Expired (Generate new token)';
      } else {
        const mins = String(Math.floor(remainingSec / 60)).padStart(2, '0');
        const secs = String(remainingSec % 60).padStart(2, '0');
        if (timerDisplay) timerDisplay.textContent = `Expires in: ${mins}:${secs} (Server-Validated)`;
      }
    }, 1000);

    showToast('Ephemeral check-in QR generated (5-minute TTL)');
  } catch (err) {
    showToast(`Error generating check-in QR: ${err.message}`);
  }
};

window.handleSimulateCheckinVerification = async function() {
  if (!currentVerifierActiveRequest) {
    showToast('No active verification task selected');
    return;
  }

  if (!currentCheckinQrToken) {
    await handleGenerateCheckinQR();
  }

  try {
    // Pass verified location coordinates within radius (San Francisco reference)
    const verifierLocation = { lat: 37.7749, lng: -122.4194 };
    const res = await fetch(`${API_BASE}/api/verifier/checkin/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({
        requestId: currentVerifierActiveRequest.id,
        qrToken: currentCheckinQrToken,
        verifierLocation
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const badge = document.getElementById('vCheckinStatusBadge');
    if (badge) {
      badge.textContent = 'CHECKED IN (Location & Timestamp Verified)';
      badge.className = 'badge-pill badge-pill-emerald';
    }
    showToast('Check-in validated! Status: IN_PROGRESS');
  } catch (err) {
    showToast(`Check-in failed: ${err.message}`);
  }
};

window.handleSubmitVerifierDecision = async function(outcome) {
  if (!currentVerifierActiveRequest) {
    showToast('No active verification task selected');
    return;
  }

  // Collect checklist evaluations
  const checkboxes = document.querySelectorAll('.v-chk-item');
  const checklistEvaluations = [];
  checkboxes.forEach(cb => {
    const itemId = cb.getAttribute('data-item-id') || cb.id;
    checklistEvaluations.push({ id: itemId, checked: cb.checked });
  });

  const notes = document.getElementById('vDecisionNotes')?.value || '';

  try {
    const res = await fetch(`${API_BASE}/api/verifier/requests/${currentVerifierActiveRequest.id}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({
        outcome,
        checklistEvaluations,
        notes
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Attestation submitted! Result Code: ${data.result?.resultCode || outcome}`);
    await loadVerifierDashboardData();
    await loadCommitments();
    switchVerifierSubTab('earnings');
  } catch (err) {
    showToast(`Verification submission error: ${err.message}`);
  }
};

window.handleUpdateVerifierAvailability = async function(availability) {
  if (!state.auth || !state.auth.token) return;
  try {
    const res = await fetch(`${API_BASE}/api/verifier/availability`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({ availability })
    });
    if (!res.ok) throw new Error('Failed to update availability');
    showToast(`Availability set to: ${availability}`);
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
};

window.openVerifierApplicationModal = function() {
  const modal = document.getElementById('modalVerifierApplication');
  if (modal) modal.classList.remove('hidden');
};

window.closeVerifierApplicationModal = function() {
  const modal = document.getElementById('modalVerifierApplication');
  if (modal) modal.classList.add('hidden');
};

window.handleApplyVerifier = async function(e) {
  e.preventDefault();
  if (!state.auth || !state.auth.token) {
    openAuthModal('signin');
    return;
  }

  const displayName = document.getElementById('vApplyName')?.value;
  const specializations = document.getElementById('vApplySpecializations')?.value?.split(',').map(s => s.trim());
  const serviceArea = document.getElementById('vApplyServiceArea')?.value;
  const bio = document.getElementById('vApplyBio')?.value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/verifier/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({
        displayName,
        specializations,
        serviceArea,
        bio,
        verificationType: 'human_physical'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeVerifierApplicationModal();
    showToast('Verifier application submitted! Awaiting administrator approval.');
    await loadVerifierDashboardData();
  } catch (err) {
    showToast(`Application error: ${err.message}`);
  }
};

window.openRateVerifierModal = function(commitmentId, verifierId) {
  const modal = document.getElementById('modalRateVerifier');
  const cmInput = document.getElementById('rateCommitmentId');
  const vInput = document.getElementById('rateVerifierId');
  if (cmInput) cmInput.value = commitmentId;
  if (vInput) vInput.value = verifierId || 'v_alex';
  if (modal) modal.classList.remove('hidden');
};

window.closeRateVerifierModal = function() {
  const modal = document.getElementById('modalRateVerifier');
  if (modal) modal.classList.add('hidden');
};

window.handleConfirmRateVerifier = async function(e) {
  e.preventDefault();
  if (!state.auth || !state.auth.token) {
    openAuthModal('signin');
    return;
  }

  const commitmentId = document.getElementById('rateCommitmentId')?.value;
  const verifierId = document.getElementById('rateVerifierId')?.value;
  const rating = Number(document.getElementById('rateStarSelect')?.value || 5);
  const comment = document.getElementById('rateCommentInput')?.value || '';

  try {
    const res = await fetch(`${API_BASE}/api/verifier/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.auth.token}`
      },
      body: JSON.stringify({ commitmentId, verifierId, rating, comment })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeRateVerifierModal();
    showToast(`Rating submitted! Thank you for rating ${verifierId}.`);
  } catch (err) {
    showToast(`Rating failed: ${err.message}`);
  }
};

