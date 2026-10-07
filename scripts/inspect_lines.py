import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('public/css/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if any(k in line for k in ['.container', '.grid-cards', 'header {', '.hero-banner', '.hero-content', '.hero-headline', '.hero-stats', '.commitment-card', '.nav-tabs']):
        print(f"{i+1:4d}: {line.strip()}")
