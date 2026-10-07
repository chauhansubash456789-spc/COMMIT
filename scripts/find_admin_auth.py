with open('tests/auth_tests.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for line in lines:
    if 'ADMIN' in line or 'admin' in line:
        if 'email' in line.lower() or 'token' in line.lower() or 'password' in line.lower():
            print(line.strip())
