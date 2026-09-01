# Dog Cockpit Usage Guide 🐕🚀

This guide shows how to integrate the adorable dog cockpit animations into your game.

## GLB armature (optional)

`DogCockpitController` binds named bones / Object3Ds on `rocket.glb`. If the file has no armature (live `rocket.glb` currently has none), it attaches a **procedural cockpit dog** with the same node names so idle / thrust / collect still animate.

A later Blender export can skip the fallback by including any of:

- Bones or meshes named `body`, `head`, `tail`, `leftEar`, `rightEar`, `nose`
- Groups named `pilotGroup` / `pilotHead`

The fallback is skipped when `body`, `head`, or `pilotGroup` is already found on the GLB (including `SkinnedMesh` skeleton bones).

## Quick Start

### 1. Import the Dog Cockpit Controller

```typescript
import { 
    DogCockpitController, 
    DogAnimationState, 
    DogAccessory,
    createDogCockpitIntegration 
} from './dog_cockpit';
```

### 2. Create the Controller Instance

Add this near your other game initialization code in `main.ts`:

```typescript
// Create dog cockpit controller
const dogController = new DogCockpitController();

// Optional: Set up animation callbacks
dogController.onAnimation((state) => {
    console.log('🐕 Dog animation:', state);
});
```

### 3. Initialize After Rocket Loads

In the rocket GLB loading callback (around line 320 in main.ts):

```typescript
// Inside the GLTF loader success callback:
gltfLoader.load('rocket.glb', (gltf) => {
    const rocketModel = gltf.scene;
    
    // ... existing setup code ...
    
    // Initialize dog cockpit controller
    const rocketRoot = player.children[0];
    if (rocketRoot) {
        dogController.initialize(rocketRoot);
        
        // Optional: Equip unlocked accessories
        if (saveManager.getStats().bossesDefeated >= 1) {
            dogController.createAccessory(DogAccessory.CAPE);
            dogController.equipAccessory(DogAccessory.CAPE);
        }
    }
    
    console.log('🚀 Rocket loaded with dog animations!');
});
```

### 4. Update in Game Loop

In the `animate()` function, add the dog controller update:

```typescript
function animate(time: number) {
    const deltaTime = 0.016; // or calculate from actual time
    
    // ... existing game logic ...
    
    // Update dog animations
    if (dogController) {
        // Check for thrust
        if (keys.jump) {
            dogController.triggerAnimation(DogAnimationState.THRUST);
        } else if (dogController.getCurrentState() === DogAnimationState.THRUST) {
            dogController.triggerAnimation(DogAnimationState.IDLE);
        }
        
        // Update the controller
        dogController.update(deltaTime, playerState);
    }
    
    // ... rest of game loop ...
}
```

## Game Event Integration

### On Collectible Pickup

```typescript
// When collecting cores/items
function onCollectItem(item: any) {
    dogController.triggerAnimation(DogAnimationState.COLLECT, 0.5);
    
    // Optional: Add to score
    saveManager.addCores(1);
}
```

### On Power-Up Activation

```typescript
// When activating power-ups
function onPowerUp(powerUpType: string) {
    dogController.triggerAnimation(DogAnimationState.POWER_UP, 2.0);
    
    // Add particle effects, sounds, etc.
    audioSystem.play('powerup');
}
```

### On Taking Damage

```typescript
// When player gets hit
function onPlayerHit(damage: number) {
    playerState.health -= damage;
    dogController.triggerAnimation(DogAnimationState.HIT, 1.0);
    
    // Screen shake, sound effects
    cameraShake(0.5);
    audioSystem.play('hit');
}
```

### On Victory

```typescript
// When reaching the moon/winning
function onVictory() {
    dogController.triggerAnimation(DogAnimationState.VICTORY, 5.0);
    saveManager.recordRunCompleted();
    
    // Victory fanfare!
    audioSystem.play('victory');
}
```

## Complete Integration Helper

Use the built-in integration helper for cleaner code:

```typescript
import { createDogCockpitIntegration } from './dog_cockpit';

// Create the integration
const dogIntegration = createDogCockpitIntegration(
    dogController,
    player,
    playerState,
    keys
);

// Initialize after rocket loads
dogIntegration.initialize();

// In game loop
dogIntegration.update(deltaTime);

// On events
dogIntegration.onCollect();
dogIntegration.onPowerUp();
dogIntegration.onHit();
dogIntegration.onVictory();
```

## Accessory System

### Available Accessories

```typescript
enum DogAccessory {
    TUTU = 'tutu',           // 50 cores
    CAPE = 'cape',           // 100 cores (requires 1 boss defeat)
    BOW = 'bow',             // 25 cores
    GLASSES = 'glasses',     // 75 cores (requires 100 cores collected)
    CROWN = 'crown'          // 200 cores (requires 1 run completed)
}
```

### Equip Accessories

```typescript
// Create and equip immediately
dogController.equipAccessory(DogAccessory.TUTU);

// Create first, equip later
dogController.createAccessory(DogAccessory.CAPE);
// ... later ...
dogController.equipAccessory(DogAccessory.CAPE);

// Toggle on/off
const isEquipped = dogController.toggleAccessory(DogAccessory.BOW);

// Unequip
dogController.unequipAccessory(DogAccessory.GLASSES);

// Check equipped
if (dogController.isAccessoryEquipped(DogAccessory.CROWN)) {
    console.log('Royal pup! 👑');
}
```

### Shop Integration

Add to your shop UI:

```typescript
import { ACCESSORY_UNLOCKS, DogAccessory } from './dog_cockpit';

function createAccessoryShop() {
    const container = document.createElement('div');
    
    Object.entries(ACCESSORY_UNLOCKS).forEach(([key, unlock]) => {
        // Check requirements
        const canUnlock = !unlock.requirement || unlock.requirement();
        const canAfford = saveManager.getCores() >= unlock.cost;
        
        const button = document.createElement('button');
        button.textContent = `${unlock.name} - ${unlock.cost}🔷`;
        button.disabled = !canUnlock || !canAfford;
        button.onclick = () => {
            if (saveManager.spendCores(unlock.cost)) {
                dogController.equipAccessory(unlock.type);
            }
        };
        
        container.appendChild(button);
    });
    
    return container;
}
```

## Advanced Features

### Custom Look Target

```typescript
// Dog head follows mouse by default
// But you can also set programmatic targets:
dogController.setLookTarget(screenX, screenY);

// Or lock to specific direction
dogController.setLookTarget(window.innerWidth * 0.8, window.innerHeight * 0.5);
```

### Manual Animation Control

```typescript
// Direct control over specific animations
dogController.wagTail(15, 0.4);        // Fast wag
dogController.perkEars(0.8);            // Ears up
dogController.tiltHead(0.3);            // Curious tilt
dogController.bounceBody(0.5);          // Excited bounce
```

### Get Dog's Mood

```typescript
const happiness = dogController.getHappiness();  // 0-1
const excitement = dogController.getExcitement(); // 0-1

if (happiness > 0.8) {
    console.log('Happy pup! 🐕❤️');
}
```

## Animation States Reference

| State | Description | Automatic Triggers |
|-------|-------------|-------------------|
| `IDLE` | Gentle breathing, ear twitches | Default state |
| `THRUST` | Fast tail wag, ears back | While holding jump key |
| `COLLECT` | Happy ears, head bobs | On collecting items |
| `POWER_UP` | Full dance, tail frenzy | On power-up activation |
| `HIT` | Sad ears, worried pose | On taking damage |
| `VICTORY` | Paws up, maximum wag | On winning |

## Keyboard Shortcuts for Testing

Add these for debugging during development:

```typescript
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case '1': dogController.triggerAnimation(DogAnimationState.IDLE); break;
        case '2': dogController.triggerAnimation(DogAnimationState.THRUST); break;
        case '3': dogController.triggerAnimation(DogAnimationState.COLLECT, 1); break;
        case '4': dogController.triggerAnimation(DogAnimationState.POWER_UP, 2); break;
        case '5': dogController.triggerAnimation(DogAnimationState.HIT, 1); break;
        case '6': dogController.triggerAnimation(DogAnimationState.VICTORY, 5); break;
        case 't': dogController.toggleAccessory(DogAccessory.TUTU); break;
        case 'c': dogController.toggleAccessory(DogAccessory.CAPE); break;
        case 'b': dogController.toggleAccessory(DogAccessory.BOW); break;
    }
});
```

## Troubleshooting

### Bones Not Found

If the dog animations don't work, check the browser console for the bone status log. The controller will show which bones were found and which are missing.

Common issues:
- Different naming in the GLB file
- Bones are Object3D instead of Bone
- Pilot group has different structure

### Performance

The controller is optimized for performance:
- Minimal allocations during update
- Particle pooling (automatic)
- Efficient bone lookups (cached)

If experiencing slowdown:
- Reduce particle spawn rate
- Disable accessories when not visible
- Use `dogController.dispose()` on cleanup

## File Structure

```
dog_cockpit.ts          # Main controller
dog_cockpit_usage.md    # This guide
```

## Credits

🐕 Made with love for a 7-year-old's magical space adventure! 🚀✨
