import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('public/index.html', 'utf8');

// Ensure public/components directory exists
const compDir = path.join(process.cwd(), 'public', 'components');
if (!fs.existsSync(compDir)) {
  fs.mkdirSync(compDir, { recursive: true });
}

// 1. Header: <header> ... </header>
const headerMatch = html.match(/(<header>[\s\S]*?<\/header>)/);
if (headerMatch) {
  fs.writeFileSync(path.join(compDir, 'header.html'), headerMatch[1]);
  console.log('✓ Extracted header.html');
}

// 2. Navigation: <nav class="nav-tabs" ... </nav>
const navMatch = html.match(/(<nav class="nav-tabs"[\s\S]*?<\/nav>)/);
if (navMatch) {
  fs.writeFileSync(path.join(compDir, 'navbar.html'), navMatch[1]);
  console.log('✓ Extracted navbar.html');
}

// Extract each section
const sections = [
  { id: 'tab-dashboard', filename: 'tab-dashboard.html' },
  { id: 'tab-my-commitments', filename: 'tab-my-commitments.html' },
  { id: 'tab-wizard', filename: 'tab-wizard.html' },
  { id: 'tab-profile', filename: 'tab-profile.html' },
  { id: 'tab-study', filename: 'tab-study.html' },
  { id: 'tab-github', filename: 'tab-github.html' },
  { id: 'tab-peer', filename: 'tab-peer.html' },
  { id: 'tab-blinks', filename: 'tab-blinks.html' },
  { id: 'tab-demos', filename: 'tab-demos.html' },
  { id: 'tab-admin', filename: 'tab-admin.html' }
];

for (const sec of sections) {
  const regex = new RegExp(`(<section id="${sec.id}"[\\s\\S]*?<\\/section>)`);
  const match = html.match(regex);
  if (match) {
    fs.writeFileSync(path.join(compDir, sec.filename), match[1]);
    console.log(`✓ Extracted ${sec.filename}`);
  } else {
    console.warn(`! Section not found: ${sec.id}`);
  }
}

// Extract modals & drawers
const modals = [
  { id: 'authModalOverlay', filename: 'modal-auth.html' },
  { id: 'walletChallengeModal', filename: 'modal-wallet-challenge.html' },
  { id: 'notificationsDrawer', filename: 'drawer-notifications.html' },
  { id: 'commitmentDetailModal', filename: 'modal-commitment-detail.html' },
  { id: 'disputeModal', filename: 'modal-dispute.html' },
  { id: 'receiptModal', filename: 'modal-receipt.html' }
];

let allModalsHtml = '<!-- ============================================================================= -->\n<!-- COMPONENT: ALL APPLICATION MODALS, DRAWERS & OVERLAYS                        -->\n<!-- ============================================================================= -->\n\n';

for (const m of modals) {
  // Find container
  const regex = new RegExp(`(<(div|aside)[^>]*id="${m.id}"[\\s\\S]*?<\\/\\2>)`);
  const match = html.match(regex);
  if (match) {
    fs.writeFileSync(path.join(compDir, m.filename), match[1]);
    allModalsHtml += `<!-- MODAL: ${m.id} -->\n` + match[1] + '\n\n';
    console.log(`✓ Extracted ${m.filename}`);
  }
}

fs.writeFileSync(path.join(compDir, 'modals.html'), allModalsHtml);
console.log('✓ Extracted modals.html (all modals unified)');
