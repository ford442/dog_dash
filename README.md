# dog_dash

Dog Dash - A 3D world exploration game.

## Features

- **WebGPU rendering** - Modern GPU API for high-performance 3D graphics
- **Smooth, glossy graphics** - Rounded organic shapes with specular highlights
- **First-person controls** - Explore the world with keyboard and mouse
- **Animated elements** - Dynamic environment with clouds and effects
- **3D perspective** - Proper depth rendering with WebGPU
- **npm buildable** - Modern build system with Vite
- **Alien Flora & Geological Objects** - Inspired by the design document (plan.md):
  - **Nebula Jelly-Moss** - Floating gelatinous organisms with pulsing fractal moss cores
  - **Spore Clouds** - Interactive clouds with chain reaction mechanics (click to trigger!)
  - **Chroma-Shift Rocks** - Color-shifting crystalline rocks that change hue with distance
  - **Fractured Geodes** - Crystalline safe harbors with pulsing EM fields

## How to Run

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

### Production Build

Build the project for production:
```bash
npm run build
```

The built files will be in the `dist/` directory. You can preview the production build with:
```bash
npm run preview
```

### Requirements

- Node.js 16+ and npm
- A modern browser with WebGPU support (Chrome 113+, Edge 113+, or other browsers with WebGPU enabled)

## Controls

- **Space / W / Up Arrow** - Move up
- **A / S / Down Arrow** - Move down  
- **Mouse Click** - Shoot plasma bolts
- **K / Enter** - Fire weapon
- **H** - Toggle heat effects (debug)

## Gameplay

Navigate your rocket through 6 massive levels, blasting asteroids and dodging crazy enemy formations:

- **Smooth Controls** - No more thrust physics! Direct up/down movement with responsive feel
- **Screen Shake** - Dynamic camera reacts to speed and impacts
- **Enemy Formations** - Face 10 different pattern types:
  - Sine Wave, Spiral, Figure Eight, Lissajous curves
  - Helix, Ring, Cross, V-Formation, Diamond, Chaos
- **Survival** - Your ship can survive 3 asteroid collisions
- **Journey** - Travel 3500+ meters through Level 1 alone
- **Exploration** - Discover alien flora and geological objects

## Level Overview

1. **The Neon Garden** (3500m) - Dense alien flora, moderate speed
2. **The Asteroid Belt** (1200m) - Heavy asteroid density
3. **Orbital Descent** (2200m) - Atmospheric re-entry effects
4. **The Rusty Gauntlet** (3200m) - Industrial tunnel with moving obstacles
5. **The Astral Leviathan** (4200m) - Organic tunnel inside a space whale
6. **The Aqua Expanse** (5200m) - Waterfall and underwater sections

## Technical Details

- Built with Three.js and WebGPU renderer
- **WASM Physics** - AssemblyScript for collision detection
- **Mathematical Patterns** - Procedural enemy formations using parametric equations
- Modern WebGPU API for next-generation graphics
- Vite build system for fast development
