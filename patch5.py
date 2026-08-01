import re

with open('src/candy_obstacles/candy_parallax.ts', 'r') as f:
    content = f.read()

# Fix the uPlayerPos type issue
content = content.replace("this.uPlayerPos.value.copy(playerPos);", "(this.uPlayerPos.value as THREE.Vector3).copy(playerPos);")

with open('src/candy_obstacles/candy_parallax.ts', 'w') as f:
    f.write(content)
