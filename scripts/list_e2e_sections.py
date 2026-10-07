import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('tests/e2e_full_test.js', 'r', encoding='utf-8') as f:
    code = f.read()

lines = code.split('\n')
for line in lines:
    if '📦 [' in line:
        print(line.strip())
