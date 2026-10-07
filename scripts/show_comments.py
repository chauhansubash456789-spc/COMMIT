import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/css/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '/*' in l or '*/' in l:
        print(f"{i+1:3d}: {l.strip()}")
