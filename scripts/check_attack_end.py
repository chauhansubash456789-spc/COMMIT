import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('tests/attack_tests.js', 'r', encoding='utf-8') as f:
    code = f.read()

d_idx = code.indexOf('DISPUTED status blocks normal settlement') if hasattr(code, 'indexOf') else code.find('DISPUTED status blocks normal settlement')
print(code[d_idx:])
