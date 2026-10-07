import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
matches = re.finditer(r'<section id=\"(tab-[^\"]*)\"[^>]*>(.*?)(?=<section id=\"tab-|\s*</main>)', html, re.DOTALL)
for m in matches:
    tab_id = m.group(1)
    snippet = m.group(2)[:300].strip().replace('\n', ' ')
    print(f"Tab: {tab_id} -> {snippet[:120]}")
