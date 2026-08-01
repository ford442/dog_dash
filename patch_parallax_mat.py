import re

with open('src/candy_obstacles/candy_parallax.ts', 'r') as f:
    content = f.read()

# Fix the return type issue
content = content.replace("return mat as unknown as THREE.Material;", "return mat;")

with open('src/candy_obstacles/candy_parallax.ts', 'w') as f:
    f.write(content)
