import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/css/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

import re
matches = re.finditer(r'(\.commit-card\b[^{]*\{[^}]*\}|\.card-top\b[^{]*\{[^}]*\}|\.card-title\b[^{]*\{[^}]*\}|\.card-metric-row\b[^{]*\{[^}]*\}|\.consequence-box\b[^{]*\{[^}]*\}|\.card-actions\b[^{]*\{[^}]*\})', css)
for m in matches:
    print(m.group(0))
    print("="*40)
