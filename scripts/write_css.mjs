import fs from 'fs';

const cssContent = `/* ==========================================================================
   COMMIT PROTOCOL — TUBIK STUDIO MINIMALIST & VERSATILE DESIGN SYSTEM
   Deep Dark Slate Canvas | Tactile Insets | Restrained Accents | Sleek Geometry
   ========================================================================== */

:root {
  /* Core Dark Canvas Palette */
  --bg-canvas: #0B0D10;
  --surface-l1: #13161B;
  --surface-l2: #191D24;
  --surface-l3: #0E1014;
  
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-card: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.16);
  --border-focus: rgba(255, 107, 85, 0.5);

  /* Expressive Warm-Tone Accents */
  --hero-coral: #FF6B55;
  --hero-coral-hover: #FF533D;
  --hero-coral-tint: rgba(255, 107, 85, 0.12);
  --hero-coral-gradient: linear-gradient(135deg, #FF6B55 0%, #FF4B3A 100%);
  
  --hero-mustard: #F2BA52;
  --hero-mustard-tint: rgba(242, 186, 82, 0.12);
  
  --hero-iris: #6366F1;
  --hero-iris-tint: rgba(99, 102, 241, 0.12);
  
  --hero-mint: #7EC8A4;
  --hero-mint-tint: rgba(126, 200, 164, 0.12);

  /* Legacy Bridge Tokens */
  --sol-purple: #6366F1;
  --sol-emerald: #7EC8A4;
  --sol-cyan: #38BDF8;
  --sol-amber: #F2BA52;
  --sol-rose: #FF4B3A;

  /* Typography & Readability */
  --text-primary: #FFFFFF;
  --text-secondary: #9EACB9;
  --text-tertiary: #616B77;
  --text-inverted: #111317;

  /* Geometry & Rhythm */
  --radius-card: 22px;
  --radius-inner: 14px;
  --radius-pill: 9999px;

  /* Fonts */
  --font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.4);
  --shadow-float: 0 20px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06);
}

/* Light Theme Variables for Seamless Versatility */
[data-theme="light"] {
  --bg-canvas: #F8FAFC;
  --surface-l1: #FFFFFF;
  --surface-l2: #F1F5F9;
  --surface-l3: #F8FAFC;
  
  --border-subtle: rgba(0, 0, 0, 0.05);
  --border-card: rgba(0, 0, 0, 0.08);
  --border-hover: rgba(0, 0, 0, 0.15);
  --border-focus: rgba(255, 107, 85, 0.5);

  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-tertiary: #94A3B8;
  --text-inverted: #FFFFFF;
  
  --shadow-card: 0 4px 18px rgba(15, 23, 42, 0.05);
  --shadow-float: 0 16px 40px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06);
}

/* --------------------------------------------------------------------------
   Reset & Base Styles
   -------------------------------------------------------------------------- */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-canvas);
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  padding-bottom: 96px;
  transition: background-color 0.25s ease, color 0.25s ease;
}

/* --------------------------------------------------------------------------
   Sticky Minimal Top Bar
   -------------------------------------------------------------------------- */
header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 32px;
  background: rgba(11, 13, 16, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
  transition: all 0.2s ease;
}

[data-theme="light"] header {
  background: rgba(255, 255, 255, 0.88);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  cursor: pointer;
}

.brand-avatar,
.brand-logo-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  background: var(--hero-coral-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(255, 107, 85, 0.3);
}

.brand-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-text h1 {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  line-height: 1;
}

.site-selector-pill {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--surface-l2);
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  letter-spacing: 0.03em;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Minimalist Circular Utility Buttons */
.theme-toggle-btn,
.utility-circle-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  background: var(--surface-l2);
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 14px;
}

.theme-toggle-btn:hover,
.utility-circle-btn:hover {
  background: var(--surface-l1);
  color: var(--text-primary);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.theme-toggle-btn span:last-child {
  display: none;
}

/* Minimal Status & Wallet Badges */
.network-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-l2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.network-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--hero-mint);
  box-shadow: 0 0 8px var(--hero-mint);
}

.wallet-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-l2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.wallet-badge:hover {
  border-color: var(--border-hover);
}

.wallet-balance {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.wallet-separator {
  color: var(--border-card);
}

.wallet-balance-purple {
  color: var(--hero-iris);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.wallet-address {
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  font-size: 11px;
}

.btn-airdrop {
  background: var(--hero-coral-tint);
  border: 1px solid rgba(255, 107, 85, 0.2);
  color: var(--hero-coral);
  border-radius: var(--radius-pill);
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-airdrop:hover {
  background: var(--hero-coral);
  color: #fff;
}

.auth-header-section {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-open-auth {
  background: var(--hero-coral-gradient);
  border: none;
  color: #ffffff;
  border-radius: var(--radius-pill);
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 107, 85, 0.3);
  transition: all 0.15s ease;
}

.btn-open-auth:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(255, 107, 85, 0.45);
}

/* --------------------------------------------------------------------------
   Streamlined Floating Island Dock (Versatile & Compact)
   -------------------------------------------------------------------------- */
.nav-tabs {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 990;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(19, 22, 27, 0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-card);
  padding: 5px 8px;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-float);
  max-width: 95vw;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-tabs::-webkit-scrollbar {
  display: none;
}

[data-theme="light"] .nav-tabs {
  background: rgba(255, 255, 255, 0.9);
}

.nav-tab-btn {
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  padding: 8px 14px;
  color: var(--text-secondary);
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.nav-tab-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

[data-theme="light"] .nav-tab-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.nav-tab-btn.active {
  background: var(--surface-l2);
  color: var(--text-primary);
  font-weight: 700;
  border: 1px solid var(--border-card);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

[data-theme="light"] .nav-tab-btn.active {
  background: #FFFFFF;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}

.badge-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.badge-pill-emerald {
  background: var(--hero-mint-tint);
  color: var(--hero-mint);
}

.badge-pill-cyan {
  background: rgba(56, 189, 248, 0.12);
  color: var(--sol-cyan);
}

.badge-pill-amber {
  background: var(--hero-mustard-tint);
  color: var(--hero-mustard);
}

.badge-pill-dark {
  background: var(--surface-l3);
  color: var(--text-secondary);
}

/* --------------------------------------------------------------------------
   Main Container & Sections
   -------------------------------------------------------------------------- */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px;
}

@media (max-width: 768px) {
  .container {
    padding: 16px;
  }
  header {
    padding: 10px 16px;
  }
}

.tab-pane {
  display: none;
  animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.tab-pane.active {
  display: block;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --------------------------------------------------------------------------
   Hero Headline & Sleek Versatile Stat Cards
   -------------------------------------------------------------------------- */
.hero-banner {
  margin-bottom: 28px;
}

.hero-headline {
  margin-bottom: 20px;
}

.hero-headline h2 {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.hero-headline p {
  color: var(--text-secondary);
  font-size: 14px;
  max-width: 680px;
  line-height: 1.5;
}

/* 3-Column Minimal Stat Cards */
.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 900px) {
  .hero-stats {
    grid-template-columns: 1fr;
  }
}

.stat-box {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: var(--shadow-card);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

.stat-box:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.3);
}

.stat-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stat-label,
.stat-category-pill {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.stat-delta-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-variant-numeric: tabular-nums;
  background: var(--surface-l2);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.stat-delta-pill.badge-pill-emerald,
.stat-delta-positive {
  background: var(--hero-mint-tint);
  color: var(--hero-mint);
  border-color: rgba(126, 200, 164, 0.2);
}

.stat-value,
.stat-number {
  font-size: 32px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin-bottom: 6px;
}

.stat-micro-desc {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
}

/* Subtle top indicator lines for versatility */
.stat-box-coral::before,
.stat-box:nth-child(1)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--hero-coral-gradient);
}

.stat-box-mustard::before,
.stat-box:nth-child(2)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--hero-mustard);
}

.stat-box-dark::before,
.stat-box:nth-child(3)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--hero-mint);
}

/* --------------------------------------------------------------------------
   Active Commitments Section & Cards Grid
   -------------------------------------------------------------------------- */
.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title-sm {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

@media (max-width: 640px) {
  .grid-cards {
    grid-template-columns: 1fr;
  }
}

.commit-card {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: var(--shadow-card);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.commit-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.mode-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mode-badge.hardcore {
  background: var(--hero-coral-tint);
  color: var(--hero-coral);
  border: 1px solid rgba(255, 107, 85, 0.2);
}

.mode-badge.noloss {
  background: var(--hero-mint-tint);
  color: var(--hero-mint);
  border: 1px solid rgba(126, 200, 164, 0.2);
}

.status-badge {
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.status-badge.active {
  background: var(--hero-mint-tint);
  color: var(--hero-mint);
}

.status-badge.verified {
  background: rgba(56, 189, 248, 0.12);
  color: var(--sol-cyan);
}

.status-badge.settled {
  background: var(--hero-iris-tint);
  color: var(--hero-iris);
}

.status-badge.pending_verification {
  background: var(--hero-mustard-tint);
  color: var(--hero-mustard);
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.35;
  margin-bottom: 14px;
}

.card-metric-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: var(--surface-l3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-inner);
  padding: 10px 12px;
  margin-bottom: 12px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-item span:first-child {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-tertiary);
  letter-spacing: 0.04em;
}

.metric-item span:last-child {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.consequence-box {
  background: var(--surface-l3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-inner);
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 16px;
}

.consequence-box strong {
  color: var(--text-primary);
}

.card-actions {
  display: flex;
  gap: 8px;
}

/* --------------------------------------------------------------------------
   Buttons & Interactive Elements
   -------------------------------------------------------------------------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 700;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  text-decoration: none;
  white-space: nowrap;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: var(--hero-coral-gradient);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(255, 107, 85, 0.3);
}

.btn-primary:hover {
  box-shadow: 0 6px 18px rgba(255, 107, 85, 0.45);
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--surface-l2);
  border: 1px solid var(--border-card);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--surface-l1);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.btn-purple {
  background: var(--hero-iris);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-purple:hover {
  background: var(--sol-purple);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
  transform: translateY(-1px);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-card);
  color: var(--text-primary);
}

.btn-outline:hover {
  border-color: var(--border-hover);
  background: var(--surface-l2);
}

.btn-sm {
  padding: 6px 14px;
  font-size: 12px;
}

.btn-full {
  width: 100%;
}

.btn-submit-large {
  padding: 14px 24px;
  font-size: 14px;
  margin-top: 8px;
}

/* --------------------------------------------------------------------------
   Forms, Inputs & Wizard Card
   -------------------------------------------------------------------------- */
.wizard-card {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 28px;
  max-width: 720px;
  margin: 0 auto;
  box-shadow: var(--shadow-card);
}

.wizard-auth-card {
  text-align: center;
  padding: 48px 32px;
}

.wizard-lock-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.wizard-auth-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.wizard-auth-desc {
  color: var(--text-secondary);
  font-size: 14px;
  max-width: 440px;
  margin: 0 auto 24px;
  line-height: 1.5;
}

.wizard-steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 16px;
}

.wizard-step-node {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  background: var(--surface-l3);
  border: 1px solid var(--border-card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
}

.wizard-step-node.active .step-number {
  background: var(--hero-coral-gradient);
  color: #fff;
  border-color: transparent;
}

.form-group {
  margin-bottom: 18px;
}

.form-grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-input,
.form-select {
  width: 100%;
  background: var(--surface-l3);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-inner);
  padding: 12px 16px;
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: 14px;
  transition: all 0.15s ease;
  outline: none;
}

.form-input:focus,
.form-select:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(255, 107, 85, 0.15);
}

.input-dimmed {
  opacity: 0.6;
  cursor: not-allowed;
}

.staking-mode-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.mode-option-card {
  background: var(--surface-l3);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-inner);
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-option-card:hover {
  border-color: var(--border-hover);
}

.mode-option-card.selected {
  border-color: var(--hero-coral);
  background: var(--hero-coral-tint);
}

.mode-option-card h4 {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.mode-option-card p {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.wizard-preview-box {
  margin-top: 16px;
  margin-bottom: 20px;
}

/* --------------------------------------------------------------------------
   Deep Work Focus Studio
   -------------------------------------------------------------------------- */
.tab-header-box {
  margin-bottom: 24px;
}

.tab-main-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.tab-subtitle {
  color: var(--text-secondary);
  font-size: 13px;
  max-width: 650px;
  line-height: 1.5;
}

.focus-studio-wrap {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;
}

@media (max-width: 850px) {
  .focus-studio-wrap {
    grid-template-columns: 1fr;
  }
}

.timer-display-box {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: var(--shadow-card);
}

.timer-circle {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 4px solid var(--border-subtle);
  border-top-color: var(--hero-coral);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  position: relative;
}

.timer-time {
  font-size: 44px;
  font-weight: 900;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.timer-status-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--hero-coral);
  margin-top: 4px;
}

.timer-btn-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.feed-title {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.heartbeat-pulse-feed {
  background: var(--surface-l3);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-inner);
  padding: 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--hero-mint);
  height: 180px;
  overflow-y: auto;
  margin-bottom: 16px;
  line-height: 1.6;
}

.info-callout-card {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-inner);
  padding: 16px;
}

.callout-title {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.callout-body {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* --------------------------------------------------------------------------
   GitHub Verifier & Peer Consensus
   -------------------------------------------------------------------------- */
.verifier-card-wrap {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 24px;
  max-width: 680px;
  box-shadow: var(--shadow-card);
}

/* --------------------------------------------------------------------------
   Modals & Overlays
   -------------------------------------------------------------------------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 24px;
  width: 100%;
  max-width: 440px;
  box-shadow: var(--shadow-float);
  animation: modalScale 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 90vh;
  overflow-y: auto;
}

@keyframes modalScale {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-pill);
}

.modal-close-btn:hover {
  color: var(--text-primary);
}

.modal-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-l3);
  padding: 4px;
  border-radius: var(--radius-pill);
  margin-bottom: 16px;
}

.modal-tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-tab-btn.active {
  background: var(--surface-l1);
  color: var(--text-primary);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

/* Demo Accounts 2x2 Grid */
.demo-accounts-box {
  background: var(--surface-l3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-inner);
  padding: 12px;
  margin-bottom: 16px;
}

.demo-accounts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.demo-accounts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.demo-account-pill {
  background: var(--surface-l2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-inner);
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.demo-account-pill:hover {
  border-color: var(--border-hover);
  background: var(--surface-l1);
  transform: translateY(-1px);
}

.demo-pill-avatar {
  font-size: 16px;
}

.demo-pill-info {
  display: flex;
  flex-direction: column;
}

.demo-pill-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.demo-pill-role {
  font-size: 10px;
  color: var(--text-tertiary);
}

/* Utility Helpers */
.hidden {
  display: none !important;
}

.auth-alert-box {
  background: rgba(255, 107, 85, 0.1);
  border: 1px solid rgba(255, 107, 85, 0.25);
  color: var(--hero-coral);
  border-radius: var(--radius-inner);
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
}
`;

fs.writeFileSync('public/css/style.css', cssContent, 'utf8');
console.log('Successfully wrote simplified, versatile style.css');
