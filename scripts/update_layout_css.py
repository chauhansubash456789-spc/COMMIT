import re

# Read style.css without BOM
with open('public/css/style.css', 'r', encoding='utf-8-sig') as f:
    css = f.read()

# Strip any stray \ufeff characters anywhere in the string
css = css.replace('\ufeff', '')

# 1. Update header padding
header_pattern = r'header\s*\{[^}]*position:\s*sticky;[^}]*\}'
new_header = '''header {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 48px;
  background: rgba(13, 15, 18, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
  box-sizing: border-box;
}'''

if re.search(header_pattern, css):
    css = re.sub(header_pattern, new_header, css, count=1)
    print("Replaced header rule")

# 2. Update .container rule and media queries
container_pattern = r'\.container\s*\{[^}]*max-width:[^}]*\}'
new_container = '''.container {
  max-width: 1380px;
  margin: 0 auto;
  padding: 40px 48px 140px;
  width: 100%;
  box-sizing: border-box;
}'''

if re.search(container_pattern, css):
    css = re.sub(container_pattern, new_container, css, count=1)
    print("Replaced .container rule")

# 3. Update hero-banner, hero-headline, hero-stats, stat-box
hero_headline_pattern = r'\.hero-headline\s*h2\s*\{[^}]*\}'
new_hero_h2 = '''.hero-headline h2 {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--text-primary);
  margin-bottom: 10px;
  line-height: 1.22;
}'''
if re.search(hero_headline_pattern, css):
    css = re.sub(hero_headline_pattern, new_hero_h2, css, count=1)
    print("Replaced hero-headline h2 rule")

hero_p_pattern = r'\.hero-headline\s*p\s*\{[^}]*\}'
new_hero_p = '''.hero-headline p {
  color: var(--text-secondary);
  font-size: 15px;
  max-width: 760px;
  line-height: 1.6;
}'''
if re.search(hero_p_pattern, css):
    css = re.sub(hero_p_pattern, new_hero_p, css, count=1)
    print("Replaced hero-headline p rule")

stats_pattern = r'\.hero-stats\s*\{[^}]*\}'
new_stats = '''.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}'''
if re.search(stats_pattern, css):
    css = re.sub(stats_pattern, new_stats, css, count=1)
    print("Replaced hero-stats rule")

stat_box_pattern = r'\.stat-box\s*\{[^}]*\}'
new_stat_box = '''.stat-box {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 24px 26px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 136px;
  box-shadow: var(--shadow-card);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}'''
if re.search(stat_box_pattern, css):
    css = re.sub(stat_box_pattern, new_stat_box, css, count=1)
    print("Replaced stat-box rule")

# 4. Update section-header-row & grid-cards
grid_cards_pattern = r'\.grid-cards\s*\{[^}]*\}'
new_grid_cards = '''.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 24px;
}'''
if re.search(grid_cards_pattern, css):
    css = re.sub(grid_cards_pattern, new_grid_cards, css, count=1)
    print("Replaced grid-cards rule")

section_row_pattern = r'\.section-header-row\s*\{[^}]*\}'
new_section_row = '''.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  margin-bottom: 22px;
}'''
if re.search(section_row_pattern, css):
    css = re.sub(section_row_pattern, new_section_row, css, count=1)
    print("Replaced section-header-row rule")

# 5. Update commit-card inner padding and spacing
commit_card_pattern = r'\.commit-card\s*\{[^}]*\}'
new_commit_card = '''.commit-card {
  background: var(--surface-l1);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-card);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: var(--shadow-card);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}'''
if re.search(commit_card_pattern, css):
    css = re.sub(commit_card_pattern, new_commit_card, css, count=1)
    print("Replaced commit-card rule")

card_title_pattern = r'\.card-title\s*\{[^}]*\}'
new_card_title = '''.card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.45;
  margin-bottom: 16px;
  min-height: 46px;
}'''
if re.search(card_title_pattern, css):
    css = re.sub(card_title_pattern, new_card_title, css, count=1)
    print("Replaced card-title rule")

card_metric_pattern = r'\.card-metric-row\s*\{[^}]*\}'
new_card_metric = '''.card-metric-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background: var(--surface-l3);
  border: 1px solid var(--surface-l3-border);
  border-radius: var(--radius-inner);
  padding: 12px 14px;
  margin-bottom: 14px;
}'''
if re.search(card_metric_pattern, css):
    css = re.sub(card_metric_pattern, new_card_metric, css, count=1)
    print("Replaced card-metric-row rule")

consequence_pattern = r'\.consequence-box\s*\{[^}]*\}'
new_consequence = '''.consequence-box {
  background: var(--surface-l3);
  border: 1px solid var(--surface-l3-border);
  border-radius: var(--radius-inner);
  padding: 12px 14px;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.45;
  margin-bottom: 20px;
}'''
if re.search(consequence_pattern, css):
    css = re.sub(consequence_pattern, new_consequence, css, count=1)
    print("Replaced consequence-box rule")

# Write out clean UTF-8 without BOM
with open('public/css/style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("SUCCESS: Updated style.css with clean UTF-8 without BOMs")
