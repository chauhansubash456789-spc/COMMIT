import fs from 'fs';

let css = fs.readFileSync('public/css/style.css', 'utf8');

const extraRules = `
/* Additional Tubik Micro-Elements */
.stat-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.badge-pill-dark {
  background: rgba(0, 0, 0, 0.18);
  color: var(--text-inverted);
  font-weight: 800;
  font-size: 11px;
}

.text-inverted {
  color: var(--text-inverted) !important;
}

.stat-micro-desc {
  font-size: 12px;
  margin-top: 8px;
  font-weight: 600;
}

.stat-box:nth-child(1) .stat-micro-desc {
  color: rgba(255, 255, 255, 0.9);
}

.stat-box:nth-child(2) .stat-micro-desc {
  color: rgba(19, 21, 24, 0.75);
}

.stat-box:nth-child(3) .stat-micro-desc {
  color: var(--text-tertiary);
}
`;

if (!css.includes('.stat-top-row')) {
  css += '\n' + extraRules;
  fs.writeFileSync('public/css/style.css', css, 'utf8');
  console.log('✅ Added extra Tubik micro-elements to public/css/style.css');
}
