import * as THREE from 'three';

export enum FlowerType {
    DAISY = 0,      // Space Daisy - rotating pastel petals with heart pollen
    TULIP = 1,      // Nebula Tulip - breathing gradient petals
    LOTUS = 2,      // Lotus Constellation - multi-layered with sparkle orbs
    SUNFLOWER = 3   // Crystal Sunflower - follows player, drops golden sparkles
}

/** Configuration for each flower type */
export const FLOWER_CONFIGS = {
    [FlowerType.DAISY]: {
        petalCount: 10,
        petalColors: [0xffb6c1, 0xffffff, 0xe6e6fa], // Pink, white, lavender
        centerColor: 0xffd700, // Gold
        glowColor: 0xffeb3b,
        scaleRange: [8, 12],
        rotationSpeed: 0.3,
        bloomScale: 1.4
    },
    [FlowerType.TULIP]: {
        petalCount: 6,
        petalColors: [0x9b59b6, 0xe74c3c, 0x1abc9c], // Purple, pink, teal gradient
        centerColor: 0xf39c12,
        glowColor: 0x9b59b6,
        scaleRange: [10, 14],
        rotationSpeed: 0.15,
        bloomScale: 1.3
    },
    [FlowerType.LOTUS]: {
        petalCount: 16,
        petalColors: [0xffc0cb, 0xffb6c1, 0xff69b4], // Various pinks
        centerColor: 0xffd700,
        glowColor: 0xff69b4,
        scaleRange: [12, 16],
        rotationSpeed: 0.2,
        bloomScale: 1.5
    },
    [FlowerType.SUNFLOWER]: {
        petalCount: 20,
        petalColors: [0xffd700, 0xffa500, 0xff8c00], // Golden shades
        centerColor: 0x8b4513, // Brown
        glowColor: 0xffd700,
        scaleRange: [10, 15],
        rotationSpeed: 0.1,
        bloomScale: 1.2
    }
};

