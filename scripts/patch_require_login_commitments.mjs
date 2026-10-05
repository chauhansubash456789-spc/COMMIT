import fs from 'fs';

// =============================================================================
// 1. PATCH server/index.js: Require Auth for POST /api/commitments/create
// =============================================================================
let serverCode = fs.readFileSync('server/index.js', 'utf8');

const targetAuthBlock = `  // Authenticated account status check (blocks suspended / disabled users)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabaseAdmin.from('user_profiles').select('*').eq('auth_user_id', user.id).single();
        if (profile) {
          if (profile.status === 'SUSPENDED') {
            return res.status(403).json({ error: 'Account Suspended: Suspended users cannot create commitments.', status: 'SUSPENDED' });
          }
          if (profile.status === 'DISABLED') {
            return res.status(403).json({ error: 'Account Disabled: Access permanently denied.', status: 'DISABLED' });
          }
          if (profile.wallet_address && creator && creator !== profile.wallet_address) {
            return res.status(400).json({ error: 'Creator address must match your authenticated connected wallet' });
          }
        }
      }
    } catch (err) {
      console.warn('Auth check in commitment creation:', err.message);
    }
  }`;

const enforcedAuthBlock = `  // MANDATORY AUTHENTICATION: Without login, no one can create commitments
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication Required: You must be logged in to create a new commitment.'
    });
  }

  const token = authHeader.split(' ')[1];
  let authUser = null;
  let profile = null;

  try {
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({
        error: 'Invalid or expired session. Please log in to create a commitment.'
      });
    }
    authUser = user;

    const { data: userProfile, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profErr || !userProfile) {
      return res.status(403).json({ error: 'User profile not found. Access denied.' });
    }
    profile = userProfile;
  } catch (err) {
    return res.status(401).json({ error: 'Authentication verification failed: ' + err.message });
  }

  // Enforce account status server-side
  if (profile.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Account Suspended: Suspended users cannot create commitments.', status: 'SUSPENDED' });
  }
  if (profile.status === 'DISABLED') {
    return res.status(403).json({ error: 'Account Disabled: Access permanently denied.', status: 'DISABLED' });
  }
  if (profile.wallet_address && creator && creator !== profile.wallet_address) {
    return res.status(400).json({ error: 'Creator address must match your authenticated connected wallet' });
  }`;

if (serverCode.includes(targetAuthBlock)) {
  serverCode = serverCode.replace(targetAuthBlock, enforcedAuthBlock);
  fs.writeFileSync('server/index.js', serverCode, 'utf8');
  console.log('✅ Successfully patched server/index.js to strictly enforce authentication on /api/commitments/create');
} else {
  console.log('⚠️ Could not find exact target block in server/index.js or already patched');
}

// =============================================================================
// 2. PATCH public/js/app.js: Block unauthenticated users from Wizard & Creation
// =============================================================================
let appCode = fs.readFileSync('public/js/app.js', 'utf8');

// A. Navigation Guard: Intercept click on tab-wizard
const targetNav = `function setupNavigation() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(targetTab);
      if (activePane) activePane.classList.add('active');
      state.activeTab = targetTab;
    });
  });
}`;

const enforcedNav = `function setupNavigation() {
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
}`;

if (appCode.includes(targetNav)) {
  appCode = appCode.replace(targetNav, enforcedNav);
  console.log('✅ Successfully patched setupNavigation in public/js/app.js');
}

// B. handleCreateCommitment Guard
const targetCreateCommitmentStart = `async function handleCreateCommitment() {
  const title = document.getElementById('wizardTitle').value;`;

const enforcedCreateCommitmentStart = `async function handleCreateCommitment() {
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

  const title = document.getElementById('wizardTitle').value;`;

if (appCode.includes(targetCreateCommitmentStart)) {
  appCode = appCode.replace(targetCreateCommitmentStart, enforcedCreateCommitmentStart);
  console.log('✅ Successfully patched handleCreateCommitment guard in public/js/app.js');
}

// C. Update renderAuthHeader to also toggle wizard card lock visibility
const targetRenderAuth = `function renderAuthHeader() {
  const sec = document.getElementById('authHeaderSection');
  if (!sec) return;`;

const enforcedRenderAuth = `function renderAuthHeader() {
  const sec = document.getElementById('authHeaderSection');
  if (!sec) return;

  // Toggle Wizard Locked Card vs Content Card
  const wizardAuthCard = document.getElementById('wizardAuthRequiredCard');
  const wizardFormCard = document.getElementById('wizardFormCard');
  if (wizardAuthCard && wizardFormCard) {
    if (state.auth && state.auth.token) {
      wizardAuthCard.style.display = 'none';
      wizardFormCard.style.display = 'block';
    } else {
      wizardAuthCard.style.display = 'block';
      wizardFormCard.style.display = 'none';
    }
  }`;

if (appCode.includes(targetRenderAuth)) {
  appCode = appCode.replace(targetRenderAuth, enforcedRenderAuth);
  console.log('✅ Successfully patched renderAuthHeader in public/js/app.js');
}

fs.writeFileSync('public/js/app.js', appCode, 'utf8');

// =============================================================================
// 3. PATCH public/index.html: Add wizardAuthRequiredCard
// =============================================================================
let htmlCode = fs.readFileSync('public/index.html', 'utf8');

const targetWizardSection = `    <!-- TAB 2: CREATE WIZARD -->
    <section id="tab-wizard" class="tab-pane">
      <div class="wizard-card">`;

const enforcedWizardSection = `    <!-- TAB 2: CREATE WIZARD -->
    <section id="tab-wizard" class="tab-pane">
      <!-- LOCKED CARD WHEN NOT LOGGED IN -->
      <div id="wizardAuthRequiredCard" class="wizard-card" style="text-align:center;padding:3.5rem 1.5rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">🔒</div>
        <h3 style="font-size:1.4rem;font-weight:700;margin-bottom:0.5rem;">Authentication Required</h3>
        <p style="color:var(--text-muted);max-width:440px;margin:0 auto 1.5rem;font-size:0.95rem;line-height:1.5;">
          You must be logged in to create commitments and lock USDC behind your promises. Sign in or register to get started.
        </p>
        <button class="btn btn-primary" onclick="openAuthModal('signin')" style="padding:0.75rem 2rem;font-weight:700;font-size:0.95rem;">
          🔑 Sign In / Register to Create
        </button>
      </div>

      <!-- ACTIVE WIZARD FORM WHEN LOGGED IN -->
      <div id="wizardFormCard" class="wizard-card" style="display:none;">`;

if (htmlCode.includes(targetWizardSection)) {
  htmlCode = htmlCode.replace(targetWizardSection, enforcedWizardSection);
  fs.writeFileSync('public/index.html', htmlCode, 'utf8');
  console.log('✅ Successfully patched wizard card in public/index.html');
} else {
  console.log('ℹ️ Wizard card in public/index.html already has auth cards');
}

// =============================================================================
// 4. PATCH tests/auth_tests.js: Add test for unauthenticated commitment creation
// =============================================================================
let testsCode = fs.readFileSync('tests/auth_tests.js', 'utf8');

const targetTest8 = `    // -------------------------------------------------------------------------
    // TEST 8: ACCOUNT STATUS ENFORCEMENT (SUSPENDED & DISABLED)
    // -------------------------------------------------------------------------
    console.log('\\n--- TEST 8: Account Status Enforcement (SUSPENDED & DISABLED) ---');`;

const enforcedTest8 = `    // -------------------------------------------------------------------------
    // TEST 7.5: UNAUTHENTICATED COMMITMENT CREATION BLOCKED (HTTP 401)
    // -------------------------------------------------------------------------
    console.log('\\n--- TEST 7.5: Unauthenticated Commitment Creation Strictly Blocked ---');
    const unauthCommitRes = await fetch(\`\${BASE_URL}/api/commitments/create\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthenticated Commitment Attempt',
        creator: 'AnyCreatorWallet11111111111111111111111111',
        stakingMode: 'HARDCORE',
        stakeAmount: 50,
        verifierType: 'github',
        failurePolicy: 'PARTIAL_EDUCATION_POOL',
        details: { repoOwner: 'solana-labs', repoName: 'solana' }
      })
    });
    assert(
      unauthCommitRes.status === 401,
      'Unauthenticated request to /api/commitments/create is strictly rejected (HTTP 401)'
    );

    // -------------------------------------------------------------------------
    // TEST 8: ACCOUNT STATUS ENFORCEMENT (SUSPENDED & DISABLED)
    // -------------------------------------------------------------------------
    console.log('\\n--- TEST 8: Account Status Enforcement (SUSPENDED & DISABLED) ---');`;

if (testsCode.includes(targetTest8)) {
  testsCode = testsCode.replace(targetTest8, enforcedTest8);
  fs.writeFileSync('tests/auth_tests.js', testsCode, 'utf8');
  console.log('✅ Successfully added unauthenticated commitment creation test to tests/auth_tests.js');
}

console.log('\\n🎉 All patches applied successfully!');
