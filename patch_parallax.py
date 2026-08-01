import re

with open('src/candy_obstacles/candy_parallax.ts', 'r') as f:
    content = f.read()

# Fix the duplicate block
content = content.replace("    }\n\n    }", "    }")

with open('src/candy_obstacles/candy_parallax.ts', 'w') as f:
    f.write(content)
