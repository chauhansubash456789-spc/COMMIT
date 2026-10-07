import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

lines = html.splitlines()
for i, line in enumerate(lines[:120]):
    print(f"{i+1:3d}: {line}")
