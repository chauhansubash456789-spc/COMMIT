import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/css/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

import re
matches = re.findall(r'(\b(?:header|\.container|main|\.commitment-card|\.nav-tabs|\.hero-banner|\.stat-box|\.grid-cards)\b[^{]*\{[^}]*\})', css)
for m in matches[:15]:
    print(m)
    print("="*40)
