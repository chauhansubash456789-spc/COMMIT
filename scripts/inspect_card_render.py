import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

import re
m = re.search(r'function renderCommitmentCard\b.*?return `(.*?)`;', js, re.DOTALL)
if m:
    print(m.group(1)[:500])
else:
    print("Not found by regex, searching renderCommitment...")
    for line in js.splitlines():
        if 'renderCommitment' in line or 'commitmentsGrid' in line:
            print(line)
