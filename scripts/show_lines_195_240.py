import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/css/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines[195:240]):
    print(f"{i+196:3d}: {repr(l)}")
