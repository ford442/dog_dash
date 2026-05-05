# Tutorial System Usage Guide 📚✨

## Overview
The `TutorialSystem` provides a gentle, kid-friendly introduction to Dog Dash. The adorable space dog teaches the player how to play through interactive steps with speech bubbles, visual hints, and encouraging messages.

## Quick Start

### 1. Import the Tutorial System

```typescript
import { 
    TutorialSystem, 
    TutorialStep, 
    shouldShowTutorial 
} from './tutorial_system';
```

### 2. Create Tutorial Instance

```typescript
const tutorial = new TutorialSystem(
    scene,           // THREE.Scene
    hudManager,      // HUDManager
    audioSystem,     // AudioSystem
    dogController    // DogCockpitController
);
```

### 3. Check and Start Tutorial

```typescript
// On game start, check if player has completed tutorial
if (shouldShowTutorial(saveManager)) {
    tutorial.start();
} else {
    // Skip to main game
    startMainGame();
}

// Set callback for when tutorial completes
tutorial.onComplete(() => {
    console.log('Tutorial complete! Starting main game...');
    startMainGame();
});
```

### 4. Update in Game Loop

```typescript
function gameLoop(delta: number) {
    // Update tutorial (if active)
    tutorial.update(delta);
    
    // Rest of game updates...
}
```

## Tutorial Steps

| Step | Description | Duration |
|------|-------------|----------|
| `WELCOME` | Dog introduces itself | 3 seconds |
| `MOVEMENT` | Learn to fly up/down | Manual advance |
| `COLLECT_STARS` | Collect 3 star orbs | Until collected |
| `POWER_UP_DEMO` | Experience rainbow power-up | 5 seconds |
| `AVOID_OBSTACLES` | Watch out for asteroids | Auto-advance |
| `MEET_FRIENDS` | Say hi to space kitty | Auto-advance |
| `GOAL` | Learn the objective | 4 seconds |
| `COMPLETE` | Ready to play! | 3 seconds |

## API Reference

### Methods

```typescript
// Start the tutorial sequence
tutorial.start(): void

// Advance to next step
tutorial.nextStep(): void

// Skip tutorial entirely
tutorial.skip(): void

// Update every frame
tutorial.update(delta: number): void

// Check if tutorial is complete
tutorial.isTutorialComplete(): boolean

// Get current step
tutorial.getCurrentStep(): TutorialStep

// Check if tutorial is active
tutorial.getIsActive(): boolean

// Mark an orb as collected (for COLLECT_STARS step)
tutorial.collectOrb(index: number): void

// Force a specific step (for testing)
tutorial.forceStep(step: TutorialStep): void

// Reset tutorial (for testing)
tutorial.reset(): void

// Callbacks
tutorial.onComplete(callback: () => void): void
tutorial.onSkip(callback: () => void): void
```

### Utility Functions

```typescript
// Check if tutorial should be shown
shouldShowTutorial(saveManager: SaveManager): boolean

// Reset tutorial completion (for testing)
resetTutorialCompletion(): void
```

## Visual Features

### Speech Bubbles
- Pastel pink background (#FFF0F5)
- Rounded corners with cute tail
- Bouncing dog icon 🐕
- Kid-friendly font (Comic Sans MS fallback)

### Progress Bar
- Star indicators for each step ⭐
- Current step pulses
- Completed steps are gold, pending are white

### Control Buttons
- "Next" button (green) - advance step
- "Skip" button (pink) - skip tutorial
- Big, friendly, rounded buttons

### Visual Hints
- Highlight rings around important objects
- Cursor animations showing movement
- Rainbow trails for power-up demo

## Encouragement System

Random encouraging messages appear every 3 seconds:
- "You're doing great! ⭐"
- "So good! Keep going! 🌟"
- "Wow, amazing! ✨"
- "You're a natural! 🎉"
- "Super star! 💫"

## Audio Integration

Each step plays magical sounds:
- Welcome: Giggle + twinkle
- Movement: Whoosh
- Collect: Sparkle + twinkle
- Power-up: Magic cast + heart pop
- And more!

## Save System Integration

Tutorial completion is saved to localStorage:
```
Key: 'dog_dash_tutorial_completed'
Value: 'true'
```

First-time players see the tutorial automatically. Returning players can skip it.

## Testing

```typescript
// Force a specific step
tutorial.forceStep(TutorialStep.POWER_UP_DEMO);

// Reset and restart
tutorial.reset();
tutorial.start();

// Reset save data (to see tutorial again)
resetTutorialCompletion();
```

## Example Integration in main.ts

```typescript
import { TutorialSystem, shouldShowTutorial } from './tutorial_system';

// ... after initializing all systems

const tutorial = new TutorialSystem(scene, hud, audio, dogController);

// Check on game start
if (shouldShowTutorial(saveManager)) {
    // Pause main game
    gameState.isPaused = true;
    
    // Start tutorial
    tutorial.start();
    
    // Resume main game when done
    tutorial.onComplete(() => {
        gameState.isPaused = false;
        saveManager.save(); // Save that tutorial is complete
    });
    
    tutorial.onSkip(() => {
        gameState.isPaused = false;
    });
}

// In game loop
function animate() {
    const delta = clock.getDelta();
    
    if (tutorial.getIsActive()) {
        tutorial.update(delta);
    } else {
        // Main game update
        updateGame(delta);
    }
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
```

---

**The tutorial makes learning the game feel like a fun story, not a lesson! 🐕📚✨**
