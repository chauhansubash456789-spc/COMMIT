import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('tests/e2e_full_test.js', 'r', encoding='utf-8') as f:
    code = f.read()

a_idx = code.find('📦 [8/8]')
print(code[a_idx:])
