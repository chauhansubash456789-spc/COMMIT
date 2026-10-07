import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('public/index.html', 'utf8');
const compDir = path.join(process.cwd(), 'public', 'components');

function extractTagById(content, id) {
  const openRegex = new RegExp(`<([a-zA-Z0-9]+)[^>]*id="${id}"[^>]*>`, 'i');
  const match = content.match(openRegex);
  if (!match) return null;

  const startIndex = match.index;
  const tagName = match[1];
  let depth = 0;
  let idx = startIndex;

  // Walk forward tracking open and close tags
  const tagPattern = new RegExp(`<\\/?${tagName}[^>]*>`, 'gi');
  tagPattern.lastIndex = startIndex;

  let m;
  while ((m = tagPattern.exec(content)) !== null) {
    const matchedTag = m[0];
    if (matchedTag.startsWith(`</${tagName}`)) {
      depth--;
      if (depth === 0) {
        const endIndex = m.index + matchedTag.length;
        return content.slice(startIndex, endIndex);
      }
    } else if (!matchedTag.endsWith('/>')) {
      depth++;
    }
  }
  return null;
}

const modals = [
  { id: 'receiptModal', file: 'modal-receipt.html' },
  { id: 'authModalOverlay', file: 'modal-auth.html' },
  { id: 'walletChallengeModal', file: 'modal-wallet-challenge.html' },
  { id: 'notificationsDrawer', file: 'drawer-notifications.html' },
  { id: 'commitmentDetailModal', file: 'modal-commitment-detail.html' },
  { id: 'disputeModal', file: 'modal-dispute.html' }
];

let allModals = '<!-- ============================================================================= -->\n<!-- COMPONENT: ALL APPLICATION MODALS, DRAWERS & OVERLAYS                        -->\n<!-- ============================================================================= -->\n\n';

for (const item of modals) {
  const extracted = extractTagById(html, item.id);
  if (extracted) {
    fs.writeFileSync(path.join(compDir, item.file), extracted);
    allModals += `<!-- ----------------------------------------------------------------------------- -->\n<!-- ${item.id} -->\n<!-- ----------------------------------------------------------------------------- -->\n` + extracted + '\n\n';
    console.log(`✓ Accurately extracted ${item.file} (${extracted.length} bytes)`);
  } else {
    console.warn(`! Failed to extract modal ${item.id}`);
  }
}

fs.writeFileSync(path.join(compDir, 'modals.html'), allModals);
console.log('✓ Accurately written modals.html');
