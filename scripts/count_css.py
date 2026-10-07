with open('public/css/style.css', 'r', encoding='utf-8') as f:
    text = f.read()

print("Character count:", len(text))
print("Line count:", len(text.splitlines()))
