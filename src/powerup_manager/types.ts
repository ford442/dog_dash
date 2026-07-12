/**
 * Power-Up Manager for Dog Dash
 * Manages magical power-ups for a whimsical space adventure
 * 
 * Designed for easy extension - add new power-ups by:
 * 1. Adding to PowerUpType enum
 * 2. Adding configuration to POWER_UP_CONFIGS
 * 3. Implementing visual effects in PowerUpEffect.createVisuals()
 */

// =============================================================================
// POWER-UP TYPE DEFINITIONS
// =============================================================================

export enum PowerUpType {
    // Tier 1 - Easy Quick Wins (available from start)
    RAINBOW_COMET_TAIL = 'rainbow_comet_tail',
    FLOWER_CROWN_BOOST = 'flower_crown_boost',
    BUBBLEGUM_SHIELD = 'bubblegum_shield',
    TWINKLE_STAR_MAGNET = 'twinkle_star_magnet',
    
    // Tier 2 - Medium Fun (unlockable)
    UNICORN_HORN_BLAST = 'unicorn_horn_blast',
    DREAM_CLOUD_CARPET = 'dream_cloud_carpet',
    LULLABY_LANTERN = 'lullaby_lantern',
    PUPPY_HUG_HUG = 'puppy_hug_hug',
    
    // Tier 3 - Wow-Factor Magic (rare/powerful)
    MOONBEAM_SLIDE = 'moonbeam_slide',
    FAIRY_GODMOTHER_SPARKLE = 'fairy_godmother_sparkle',
    CANDY_CANE_VORTEX = 'candy_cane_vortex',
    STARLIGHT_TIARA = 'starlight_tiara',
    BUTTERFLY_ESCORT = 'butterfly_escort',
    MAGIC_PAINTBRUSH = 'magic_paintbrush',
    BEST_FRIEND_FOREVER_AURA = 'best_friend_forever_aura'
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface PowerUpConfig {
    type: PowerUpType;
    name: string;
    description: string;
    duration: number;           // Duration in seconds
    color: number;              // Primary color (hex)
    secondaryColor: number;     // Secondary/accent color (hex)
    soundEffect: string;        // Sound to play on activation
    tier: 1 | 2 | 3;           // Unlock tier
    icon: string;               // Emoji/icon for UI
}

export const POWER_UP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
    // Tier 1
    [PowerUpType.RAINBOW_COMET_TAIL]: {
        type: PowerUpType.RAINBOW_COMET_TAIL,
        name: 'Rainbow Comet Tail',
        description: 'Long rainbow trail that auto-collects nearby stars and turns asteroids into candy!',
        duration: 12,
        color: 0xff6b6b,      // Pastel red
        secondaryColor: 0x48dbfb, // Pastel cyan
        soundEffect: 'powerup_rainbow',
        tier: 1,
        icon: '🌈'
    },
    [PowerUpType.FLOWER_CROWN_BOOST]: {
        type: PowerUpType.FLOWER_CROWN_BOOST,
        name: 'Flower Crown Boost',
        description: 'Gentle upward float with pollen trail that slows obstacles!',
        duration: 8,
        color: 0xffb6c1,      // Light pink
        secondaryColor: 0xdda0dd, // Plum
        soundEffect: 'powerup_flower',
        tier: 1,
        icon: '🌸'
    },
    [PowerUpType.BUBBLEGUM_SHIELD]: {
        type: PowerUpType.BUBBLEGUM_SHIELD,
        name: 'Bubblegum Shield',
        description: 'Pink heart bubble that bounces asteroids with a "boing!" sound!',
        duration: 12,
        color: 0xff69b4,      // Hot pink
        secondaryColor: 0xff1493, // Deep pink
        soundEffect: 'powerup_shield',
        tier: 1,
        icon: '🫧'
    },
    [PowerUpType.TWINKLE_STAR_MAGNET]: {
        type: PowerUpType.TWINKLE_STAR_MAGNET,
        name: 'Twinkle Star Magnet',
        description: 'Pulls stars toward your rocket with magical rainbow lines!',
        duration: 10,
        color: 0xffd700,      // Gold
        secondaryColor: 0xff69b4, // Hot pink
        soundEffect: 'powerup_magnet',
        tier: 1,
        icon: '✨'
    },
    
    // Tier 2
    [PowerUpType.UNICORN_HORN_BLAST]: {
        type: PowerUpType.UNICORN_HORN_BLAST,
        name: 'Unicorn Horn Blast',
        description: 'Shoots a beam of stars that transforms asteroids into butterflies!',
        duration: 8,
        color: 0xffb6c1,
        secondaryColor: 0x9370db,
        soundEffect: 'powerup_unicorn',
        tier: 2,
        icon: '🦄'
    },
    [PowerUpType.DREAM_CLOUD_CARPET]: {
        type: PowerUpType.DREAM_CLOUD_CARPET,
        name: 'Dream Cloud Carpet',
        description: 'Ride on a fluffy rainbow cloud - auto-hover mode!',
        duration: 10,
        color: 0xe6e6fa,
        secondaryColor: 0xffb6c1,
        soundEffect: 'powerup_cloud',
        tier: 2,
        icon: '☁️'
    },
    [PowerUpType.LULLABY_LANTERN]: {
        type: PowerUpType.LULLABY_LANTERN,
        name: 'Lullaby Lantern',
        description: 'Singing lantern makes obstacles gently sway aside!',
        duration: 12,
        color: 0xffd700,
        secondaryColor: 0xffa500,
        soundEffect: 'powerup_lantern',
        tier: 2,
        icon: '🏮'
    },
    [PowerUpType.PUPPY_HUG_HUG]: {
        type: PowerUpType.PUPPY_HUG_HUG,
        name: 'Puppy Hug Hug',
        description: 'Golden heart aura doubles collectible value + extra life!',
        duration: 10,
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        soundEffect: 'powerup_hug',
        tier: 2,
        icon: '🤗'
    },
    
    // Tier 3
    [PowerUpType.MOONBEAM_SLIDE]: {
        type: PowerUpType.MOONBEAM_SLIDE,
        name: 'Moonbeam Slide',
        description: 'Silver slide from rocket for super speed and bonus stars!',
        duration: 8,
        color: 0xc0c0c0,
        secondaryColor: 0xffffff,
        soundEffect: 'powerup_moonbeam',
        tier: 3,
        icon: '🌙'
    },
    [PowerUpType.FAIRY_GODMOTHER_SPARKLE]: {
        type: PowerUpType.FAIRY_GODMOTHER_SPARKLE,
        name: 'Fairy Godmother Sparkle',
        description: 'Tiny fairy dog grants a random power-up for free!',
        duration: 5,
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        soundEffect: 'powerup_fairy',
        tier: 3,
        icon: '🧚'
    },
    [PowerUpType.CANDY_CANE_VORTEX]: {
        type: PowerUpType.CANDY_CANE_VORTEX,
        name: 'Candy Cane Vortex',
        description: 'Swirling tornado that pops obstacles into jellybean confetti!',
        duration: 10,
        color: 0xff0000,
        secondaryColor: 0xffffff,
        soundEffect: 'powerup_vortex',
        tier: 3,
        icon: '🍭'
    },
    [PowerUpType.STARLIGHT_TIARA]: {
        type: PowerUpType.STARLIGHT_TIARA,
        name: 'Starlight Tiara',
        description: 'Invincible! Leave a trail of permanent bonus stars!',
        duration: 8,
        color: 0xffd700,
        secondaryColor: 0x00ffff,
        soundEffect: 'powerup_tiara',
        tier: 3,
        icon: '👑'
    },
    [PowerUpType.BUTTERFLY_ESCORT]: {
        type: PowerUpType.BUTTERFLY_ESCORT,
        name: 'Butterfly Escort',
        description: 'Swarm of butterflies blocks 2-3 hits automatically!',
        duration: 15,
        color: 0xffb6c1,
        secondaryColor: 0x9370db,
        soundEffect: 'powerup_butterfly',
        tier: 3,
        icon: '🦋'
    },
    [PowerUpType.MAGIC_PAINTBRUSH]: {
        type: PowerUpType.MAGIC_PAINTBRUSH,
        name: 'Magic Paintbrush',
        description: 'Paint rainbow bridges with your mouse!',
        duration: 12,
        color: 0xff69b4,
        secondaryColor: 0x00ff00,
        soundEffect: 'powerup_paint',
        tier: 3,
        icon: '🎨'
    },
    [PowerUpType.BEST_FRIEND_FOREVER_AURA]: {
        type: PowerUpType.BEST_FRIEND_FOREVER_AURA,
        name: 'Best Friend Forever Aura',
        description: 'Time slows, everything sparkles, pure joy!',
        duration: 10,
        color: 0xff69b4,
        secondaryColor: 0xffd700,
        soundEffect: 'powerup_bff',
        tier: 3,
        icon: '💖'
    }
};

// =============================================================================
// GAMEPLAY EFFECTS INTERFACE
// =============================================================================

export interface GameplayModifiers {
    // Movement modifiers
    gravityMultiplier: number;       // 0 = no gravity, 1 = normal, -0.5 = float up
    speedMultiplier: number;         // Movement speed modifier
    autoCollectRadius: number;       // Radius for auto-collecting orbs/stars
    
    // Defense modifiers
    shieldActive: boolean;           // Shield protects from damage
    shieldBouncesAsteroids: boolean; // Asteroids bounce off instead of damage
    invincible: boolean;             // Complete invincibility
    butterflyCharges: number;        // Butterfly escort charges
    
    // Collection modifiers
    magnetRadius: number;            // Radius to pull collectibles
    doubleValue: boolean;            // Double collectible value
    
    // Obstacle modifiers
    obstaclesSlowed: boolean;        // Obstacles move slower
    obstacleSlowFactor: number;      // How much slower (0.5 = half speed)
    asteroidsToCandy: boolean;       // Touching asteroids turns them to candy
    asteroidsToButterflies: boolean; // Shooting asteroids makes butterflies
    
    // Time modifiers
    timeScale: number;               // Game time scale (0.5 = half speed)
    
    // Visual modifiers
    sparkle: boolean;                // Extra sparkles everywhere
}

export const DEFAULT_GAMEPLAY_MODIFIERS: GameplayModifiers = {
    gravityMultiplier: 1,
    speedMultiplier: 1,
    autoCollectRadius: 0,
    shieldActive: false,
    shieldBouncesAsteroids: false,
    invincible: false,
    butterflyCharges: 0,
    magnetRadius: 0,
    doubleValue: false,
    obstaclesSlowed: false,
    obstacleSlowFactor: 1,
    asteroidsToCandy: false,
    asteroidsToButterflies: false,
    timeScale: 1,
    sparkle: false
};

// =============================================================================
// MAP ITERATION HELPERS (for ES5 compatibility)
// =============================================================================

export function mapValuesToArray<T>(map: Map<any, T>): T[] {
    const result: T[] = [];
    map.forEach((value) => result.push(value));
    return result;
}

export function mapEntriesToArray<K, V>(map: Map<K, V>): [K, V][] {
    const result: [K, V][] = [];
    map.forEach((value, key) => result.push([key, value]));
    return result;
}

export function mapKeysToArray<K>(map: Map<K, any>): K[] {
    const result: K[] = [];
    map.forEach((_, key) => result.push(key));
    return result;
}

// =============================================================================
// VISUAL EFFECTS
// =============================================================================

export interface TrailConfig {
    color: number;
    secondaryColor?: number;
    particleCount: number;
    particleSize: number;
    lifetime: number;
    rainbow: boolean;
    sparkle: boolean;
}

export const TRAIL_CONFIGS: Record<PowerUpType, TrailConfig> = {
    [PowerUpType.RAINBOW_COMET_TAIL]: {
        color: 0xff6b6b,
        secondaryColor: 0x48dbfb,
        particleCount: 45,
        particleSize: 0.45,
        lifetime: 2.5,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.FLOWER_CROWN_BOOST]: {
        color: 0xffb6c1,
        secondaryColor: 0xdda0dd,
        particleCount: 15,
        particleSize: 0.2,
        lifetime: 1.0,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.BUBBLEGUM_SHIELD]: {
        color: 0xff69b4,
        secondaryColor: 0xff1493,
        particleCount: 10,
        particleSize: 0.25,
        lifetime: 0.8,
        rainbow: false,
        sparkle: false
    },
    [PowerUpType.TWINKLE_STAR_MAGNET]: {
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        particleCount: 12,
        particleSize: 0.2,
        lifetime: 0.6,
        rainbow: true,
        sparkle: true
    },
    // Defaults for other power-ups (customize as needed)
    [PowerUpType.UNICORN_HORN_BLAST]: {
        color: 0xffb6c1,
        secondaryColor: 0x9370db,
        particleCount: 15,
        particleSize: 0.3,
        lifetime: 1.0,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.DREAM_CLOUD_CARPET]: {
        color: 0xe6e6fa,
        secondaryColor: 0xffb6c1,
        particleCount: 10,
        particleSize: 0.4,
        lifetime: 1.2,
        rainbow: false,
        sparkle: false
    },
    [PowerUpType.LULLABY_LANTERN]: {
        color: 0xffd700,
        secondaryColor: 0xffa500,
        particleCount: 8,
        particleSize: 0.2,
        lifetime: 1.5,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.PUPPY_HUG_HUG]: {
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        particleCount: 20,
        particleSize: 0.25,
        lifetime: 1.0,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.MOONBEAM_SLIDE]: {
        color: 0xc0c0c0,
        secondaryColor: 0xffffff,
        particleCount: 15,
        particleSize: 0.3,
        lifetime: 1.0,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.FAIRY_GODMOTHER_SPARKLE]: {
        color: 0xffd700,
        secondaryColor: 0xff69b4,
        particleCount: 25,
        particleSize: 0.2,
        lifetime: 0.8,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.CANDY_CANE_VORTEX]: {
        color: 0xff0000,
        secondaryColor: 0xffffff,
        particleCount: 30,
        particleSize: 0.25,
        lifetime: 1.2,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.STARLIGHT_TIARA]: {
        color: 0xffd700,
        secondaryColor: 0x00ffff,
        particleCount: 20,
        particleSize: 0.3,
        lifetime: 2.0,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.BUTTERFLY_ESCORT]: {
        color: 0xffb6c1,
        secondaryColor: 0x9370db,
        particleCount: 15,
        particleSize: 0.2,
        lifetime: 1.0,
        rainbow: false,
        sparkle: true
    },
    [PowerUpType.MAGIC_PAINTBRUSH]: {
        color: 0xff69b4,
        secondaryColor: 0x00ff00,
        particleCount: 12,
        particleSize: 0.25,
        lifetime: 1.5,
        rainbow: true,
        sparkle: true
    },
    [PowerUpType.BEST_FRIEND_FOREVER_AURA]: {
        color: 0xff69b4,
        secondaryColor: 0xffd700,
        particleCount: 30,
        particleSize: 0.3,
        lifetime: 1.2,
        rainbow: true,
        sparkle: true
    }
};

