# 🎮 Touch Controls for Dog Dash

Kid-friendly touch controls for tablets and phones - perfect for 7-year-old fingers! 📱✨👆

## Features

### Three Control Modes

1. **👆 Follow Finger (Default)**
   - Rocket smoothly follows your finger
   - Double-tap anywhere for boost
   - Visual glowing orb under your finger
   - Best for: Small phones, youngest players

2. **🎮 Virtual Joystick**
   - Left side: drag to move up/down
   - Right side: heart-shaped boost & star-shaped fire buttons
   - Joystick appears on touch, fades when released
   - Best for: Tablets, players who prefer traditional controls

3. **👆 Tap to Move**
   - Tap above rocket = move up
   - Tap below rocket = move down
   - Hold to keep moving
   - Best for: Simple, precise control

### Kid-Friendly Design

- **Large touch targets**: 80px minimum (50% larger hit areas)
- **Visual feedback**: Glow effects on all touches
- **Haptic feedback**: Subtle vibrations on actions (if supported)
- **Pastel colors**: Soft pinks, blues, and golds
- **No accidental pauses**: Hold for 1 second to pause

### Gestures

| Gesture | Action |
|---------|--------|
| Tap | Move to position |
| Double-tap | Boost! 🚀 |
| Swipe up/down | Quick dodge |
| Hold | Continuous movement |
| Hold (1 sec) | Pause game |

## Usage

### Basic Setup

```typescript
import { TouchControlsManager, ControlMode } from './touch_controls';

// Create and initialize
const touchControls = new TouchControlsManager();
touchControls.initialize(canvas);
touchControls.setMode(ControlMode.FOLLOW_FINGER);

// In your game loop
touchControls.update();
const input = touchControls.getInput();
```

### Using Touch Input

```typescript
const input = touchControls.getInput();

// Movement (range -1 to 1)
player.y += input.vertical * speed;
player.x += input.horizontal * speed;

// Actions
if (input.boost) activateBoost();
if (input.fire) weaponSystem.fire();
if (input.pause) togglePause();
```

### Settings UI

```typescript
import { showTouchSettings, createTouchSettingsButton } from './touch_settings';

// Show settings panel
showTouchSettings(touchControls);

// Or add a settings button
const btn = createTouchSettingsButton(touchControls);
document.body.appendChild(btn);
```

## API Reference

### `TouchControlsManager`

| Method | Description |
|--------|-------------|
| `initialize(canvas)` | Set up event listeners |
| `setMode(mode)` | Switch control mode |
| `getInput()` | Get current input state |
| `update()` | Update virtual joystick UI |
| `show()` / `hide()` | Toggle visibility |
| `isTouchDevice()` | Check if touch is available |
| `setRocketPosition(pos, screenPos)` | Update rocket position for follow mode |
| `destroy()` | Clean up event listeners |

### `TouchInput` Interface

```typescript
interface TouchInput {
    vertical: number;   // -1 (down) to 1 (up)
    horizontal: number; // -1 (left) to 1 (right)
    boost: boolean;     // Boost activated
    fire: boolean;      // Fire button pressed
    pause: boolean;     // Pause requested
    active: boolean;    // Any touch active
}
```

### Control Modes

```typescript
enum ControlMode {
    FOLLOW_FINGER,     // 0
    VIRTUAL_JOYSTICK,  // 1
    TAP_TO_MOVE        // 2
}
```

## Files

| File | Description |
|------|-------------|
| `touch_controls.ts` | Main touch controls system |
| `touch_settings.ts` | Settings UI and persistence |
| `docs/touch_integration_example.ts` | Integration examples (documentation only) |

## Customization

### Changing Button Sizes

```typescript
// In your CSS or by modifying the constants in touch_controls.ts
const TOUCH_TARGET_SIZE = 100; // Larger for smaller children
const BUTTON_SIZE = 120;       // Bigger buttons
```

### Custom Colors

```typescript
// Pastel colors used
const PASTEL_PINK = 'rgba(255,182,193,0.8)';
const PASTEL_BLUE = 'rgba(173,216,230,0.8)';
const GOLD_GLOW = 'rgba(255,215,0,0.6)';
```

### Sensitivity

```typescript
// Adjust smoothing (0-1)
touchControls['smoothingFactor'] = 0.2; // More responsive
```

## Settings Persistence

Settings are automatically saved to `localStorage`:

```typescript
// Load saved settings
import { loadTouchSettings } from './touch_settings';
const settings = loadTouchSettings();

// Settings include:
// - Control mode
// - Sensitivity
// - Button size
// - Haptic feedback on/off
// - Visual effects on/off
// - Left-handed mode
```

## Browser Support

- ✅ iOS Safari (iPad, iPhone)
- ✅ Chrome for Android
- ✅ Chrome Desktop (with touch screen)
- ✅ Firefox
- ✅ Edge

## Tips for Parents

1. **Start with Follow Finger mode** - easiest for young children
2. **Use a tablet if possible** - larger screen = easier control
3. **Enable haptic feedback** - helps children feel their inputs
4. **Try the settings** - adjust sensitivity to your child's preference
5. **Clean the screen** - fingerprints make touch less responsive

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Touch not working | Check if `touchControls.initialize(canvas)` was called |
| Buttons too small | Change button size in settings or use Follow Finger mode |
| Too sensitive | Lower sensitivity in settings |
| Not responsive | Check `touchControls.update()` is called every frame |
| Accidental pauses | Remind child not to hold too long |

## License

Part of Dog Dash - A magical space game for kids! 🐕🚀
