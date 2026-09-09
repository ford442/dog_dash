/** Types of collectible orbs */
export enum OrbType {
    STAR = 'star',
    MAGIC_BONE = 'magic_bone',
    HEART = 'heart'
}

/** Pastel color palette for magical girl aesthetic */
export const PASTEL_COLORS = {
    pink: 0xFFB6C1,      // Light pink
    lavender: 0xE6E6FA,  // Lavender
    mint: 0x98FF98,      // Mint green
    skyBlue: 0x87CEEB,   // Sky blue
    peach: 0xFFDAB9,     // Peach
    cream: 0xFFF8DC      // Cream
};

/** Star orb color variations */
export const STAR_COLORS = [
    PASTEL_COLORS.pink,
    PASTEL_COLORS.lavender,
    PASTEL_COLORS.mint,
    PASTEL_COLORS.skyBlue
];

/** Configuration for each orb type */
export const ORB_CONFIG = {
    [OrbType.STAR]: {
        scale: 0.8,
        rotationSpeed: 1.5,
        floatSpeed: 2.0,
        floatAmplitude: 0.3,
        points: 10,
        glowIntensity: 2.0,
        particleColor: 0xFFD700  // Gold sparkles
    },
    [OrbType.MAGIC_BONE]: {
        scale: 1.0,
        rotationSpeed: 2.0,
        floatSpeed: 2.5,
        floatAmplitude: 0.4,
        points: 50,
        glowIntensity: 3.0,
        particleColor: 0xFF69B4  // Hot pink sparkles
    },
    [OrbType.HEART]: {
        scale: 0.9,
        rotationSpeed: 1.0,
        floatSpeed: 1.8,
        floatAmplitude: 0.25,
        points: 25,
        glowIntensity: 2.5,
        particleColor: 0xFF1493  // Deep pink sparkles
    }
};
