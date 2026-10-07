import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('tests/attack_tests.js', 'r', encoding='utf-8') as f:
    code = f.read()

print(code[:600])
