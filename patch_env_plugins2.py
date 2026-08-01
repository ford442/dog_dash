import re

with open('src/level_manager/environment_plugins.ts', 'r') as f:
    content = f.read()

content = content.replace("wishLanternSystem: { activate: () => void; deactivate: () => void };", "wishLanternSystem: { activate: () => void; deactivate: () => void; } | import('../wish_lanterns').WishLanternSystem;")
content = content.replace("weatherSystem: { activate: () => void; deactivate: () => void };", "weatherSystem: { activate: () => void; deactivate: () => void; } | import('../weather_system').WeatherSystem;")
content = content.replace("dancingJellyMossSystem: { activate: (config?: any) => void; deactivate: () => void };", "dancingJellyMossSystem: { activate: (config?: any) => void; deactivate: () => void; } | import('../dancing_jelly_moss').DancingJellyMossSystem;")
content = content.replace("dynamicStarfieldSystem: { activate: (config?: any) => void; deactivate: () => void };", "dynamicStarfieldSystem: { activate: (config?: any) => void; deactivate: () => void; } | import('../dynamic_starfield').DynamicStarfieldSystem;")
content = content.replace("dayNightCycleSystem: { activate: (config?: any) => void; deactivate: () => void };", "dayNightCycleSystem: { activate: (config?: any) => void; deactivate: () => void; } | import('../day_night_cycle').DayNightCycleSystem;")
content = content.replace("cloudCastlesSystem: { activate: (config?: any) => void; deactivate: () => void; cleanup: () => void };", "cloudCastlesSystem: { activate: (config?: any) => void; deactivate: () => void; cleanup: () => void; } | import('../cloud_castles_system').CloudCastlesSystem;")


with open('src/level_manager/environment_plugins.ts', 'w') as f:
    f.write(content)
