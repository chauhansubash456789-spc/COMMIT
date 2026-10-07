import fs from 'fs';

let css = fs.readFileSync('public/css/style.css', 'utf8');

const oldDemoStyles = `.demo-accounts-box { background: var(--surface-l3); border: 1px solid var(--surface-l3-border); border-radius: var(--radius-inner); padding: 12px; margin-bottom: 16px; }
.demo-accounts-header { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: var(--text-secondary); margin-bottom: 8px; }
.demo-accounts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.demo-account-pill {
  background: var(--surface-l2); border: 1px solid var(--border-subtle); border-radius: var(--radius-inner);
  padding: 8px 10px; cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; gap: 8px;
}
.demo-account-pill:hover { border-color: var(--border-hover); background: var(--surface-l1); transform: translateY(-1px); }
.demo-pill-avatar { font-size: 16px; }
.demo-pill-info { display: flex; flex-direction: column; }
.demo-pill-name { font-size: 12px; font-weight: 700; color: var(--text-primary); }
.demo-pill-role { font-size: 10px; color: var(--text-tertiary); }`;

const newDemoStyles = `/* Quick Demo Logins 2x2 Grid (Tubik Studio Dark Theme) */
.demo-accounts-box {
  background: var(--surface-l3);
  border: 1px solid var(--surface-l3-border);
  border-radius: var(--radius-inner);
  padding: 14px;
  margin-bottom: 18px;
}

.demo-box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.demo-box-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.demo-box-title strong {
  color: var(--text-primary);
}

.badge-pill-ready {
  background: var(--hero-mint-tint);
  color: var(--hero-mint);
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(126, 200, 164, 0.25);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.demo-grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-demo-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface-l2);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-inner);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: var(--font-family);
  width: 100%;
  color: var(--text-primary);
  outline: none;
}

.btn-demo-card:hover {
  background: var(--surface-l1);
  border-color: var(--hero-coral);
  box-shadow: 0 4px 14px rgba(255, 107, 85, 0.2);
  transform: translateY(-1px);
}

[data-theme="light"] .btn-demo-card {
  background: #ffffff;
  border-color: rgba(0, 0, 0, 0.1);
}

[data-theme="light"] .btn-demo-card:hover {
  background: #f8fafc;
  border-color: var(--hero-coral);
}

.demo-card-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.demo-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.demo-card-name {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-theme="light"] .demo-card-name {
  color: #0f172a;
}

.demo-card-role {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
}

.wallet-challenge-desc {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;
}`;

if (css.includes(oldDemoStyles)) {
  css = css.replace(oldDemoStyles, newDemoStyles);
  fs.writeFileSync('public/css/style.css', css, 'utf8');
  console.log('Successfully replaced demo card styles in public/css/style.css');
} else {
  console.log('Could not find oldDemoStyles string, checking lines');
}
