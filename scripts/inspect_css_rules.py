import re

with open('public/css/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

rules_to_find = [
    'body', 'header', '.container', 'main', '.hero-banner', '.hero-content',
    '.hero-headline', '.hero-stats', '.stat-box', '.section-header-row',
    '.grid-cards', '.commitment-card', '.nav-tabs'
]

for rule in rules_to_find:
    pattern = re.compile(rf'(?:^|\n)({re.escape(rule)}\s*\{{[^\}}]*\}})', re.MULTILINE)
    matches = pattern.findall(css)
    print(f"=== {rule} ===")
    for m in matches[:2]:
        print(m[:200])
        print("---")
