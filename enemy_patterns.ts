import * as THREE from 'three';

// Mathematical enemy formation patterns for Dog Dash
// Uses parametric equations for interesting movement patterns

export type PatternType = 
    | 'sine_wave' 
    | 'spiral' 
    | 'figure_eight' 
    | 'lissajous' 
    | 'helix' 
    | 'ring' 
    | 'cross' 
    | 'v_formation'
    | 'diamond'
    | 'chaos';

export interface PatternConfig {
    type: PatternType;
    centerX: number;
    centerY: number;
    count: number;
    spacing: number;
    speed: number;
    amplitude?: number;
    frequency?: number;
    phase?: number;
    radius?: number;
}

export interface EnemyInstance {
    mesh: THREE.Mesh;
    basePosition: THREE.Vector3;
    patternOffset: number;
    timeOffset: number;
    speed: number;
    pattern: PatternType;
    amplitude: number;
    frequency: number;
    phase: number;
    radius: number;
}

// Generate positions for different patterns
export function generatePatternPositions(config: PatternConfig): THREE.Vector3[] {
    const positions: THREE.Vector3[] = [];
    const { type, centerX, centerY, count, spacing } = config;

    switch (type) {
        case 'sine_wave': {
            // Classic sine wave formation
            for (let i = 0; i < count; i++) {
                const x = centerX + i * spacing;
                const y = centerY;
                positions.push(new THREE.Vector3(x, y, 0));
            }
            break;
        }
        
        case 'spiral': {
            // Archimedean spiral
            const a = config.radius || 2;
            const b = spacing / (2 * Math.PI);
            for (let i = 0; i < count; i++) {
                const theta = i * 0.5;
                const r = a + b * theta;
                const x = centerX + r * Math.cos(theta);
                const y = centerY + r * Math.sin(theta) * 0.5; // Flattened spiral
                positions.push(new THREE.Vector3(x, y, 0));
            }
            break;
        }
        
        case 'figure_eight': {
            // Lemniscate (figure-8) formation
            const a = config.amplitude || 3;
            for (let i = 0; i < count; i++) {
                const t = (i / count) * 2 * Math.PI;
                const x = centerX + spacing * i;
                const y = centerY + a * Math.sin(t);
                positions.push(new THREE.Vector3(x, y, 0));
            }
            break;
        }
        
        case 'lissajous': {
            // Lissajous curve formation
            const A = config.amplitude || 4;
            const B = (config.amplitude || 4) * 0.6;
            const a = 3, b = 2; // Frequency ratios
            const delta = config.phase || 0;
            for (let i = 0; i < count; i++) {
                const t = (i / count) * 2 * Math.PI;
                const x = centerX + spacing * i;
                const y = centerY + A * Math.sin(a * t + delta) + B * Math.sin(b * t);
                positions.push(new THREE.Vector3(x, y, 0));
            }
            break;
        }
        
        case 'helix': {
            // 3D helix (enemies at different Z depths)
            const radius = config.radius || 3;
            for (let i = 0; i < count; i++) {
                const theta = (i / count) * 4 * Math.PI;
                const x = centerX + i * spacing * 0.5;
                const y = centerY + radius * Math.cos(theta);
                const z = radius * Math.sin(theta);
                positions.push(new THREE.Vector3(x, y, z));
            }
            break;
        }
        
        case 'ring': {
            // Circular ring formation
            const radius = config.radius || 5;
            for (let i = 0; i < count; i++) {
                const theta = (i / count) * 2 * Math.PI;
                const x = centerX + radius * Math.cos(theta);
                const y = centerY + radius * Math.sin(theta);
                positions.push(new THREE.Vector3(x, y, 0));
            }
            break;
        }
        
        case 'cross': {
            // Plus/cross formation
            const arm = Math.floor(count / 4);
            // Horizontal
            for (let i = -arm; i <= arm; i++) {
                positions.push(new THREE.Vector3(centerX + i * spacing, centerY, 0));
            }
            // Vertical
            for (let i = -arm; i <= arm; i++) {
                if (i !== 0) { // Avoid center duplicate
                    positions.push(new THREE.Vector3(centerX, centerY + i * spacing, 0));
                }
            }
            break;
        }
        
        case 'v_formation': {
            // V-shaped formation (like birds)
            const half = Math.floor(count / 2);
            for (let i = 0; i < count; i++) {
                const offset = i - half;
                const x = centerX + Math.abs(offset) * spacing;
                const y = centerY + offset * spacing * 0.8;
                positions.push(new THREE.Vector3(x, y, 0));
            }
            break;
        }
        
        case 'diamond': {
            // Diamond/rhombus formation
            const layers = Math.ceil(count / 4);
            let created = 0;
            for (let layer = 0; layer < layers && created < count; layer++) {
                const size = layers - layer;
                // Top point
                if (created < count) {
                    positions.push(new THREE.Vector3(centerX, centerY + layer * spacing, 0));
                    created++;
                }
                // Bottom point
                if (created < count) {
                    positions.push(new THREE.Vector3(centerX, centerY - layer * spacing, 0));
                    created++;
                }
                // Left and right
                for (let i = 1; i <= size && created < count; i++) {
                    positions.push(new THREE.Vector3(centerX - i * spacing, centerY, 0));
                    created++;
                    if (created < count) {
                        positions.push(new THREE.Vector3(centerX + i * spacing, centerY, 0));
                        created++;
                    }
                }
            }
            break;
        }
        
        case 'chaos': {
            // Chaotic/random but with some structure (strange attractor-like)
            let x = centerX, y = centerY;
            for (let i = 0; i < count; i++) {
                // Lorenz-like chaotic system simplified
                const dt = 0.01;
                const sigma = 10, rho = 28, beta = 8/3;
                const dx = sigma * (y - x) * dt;
                const dy = (x * (rho - 1) - y) * dt;
                x += dx * spacing * 0.1;
                y += dy * spacing * 0.1;
                positions.push(new THREE.Vector3(centerX + i * spacing * 0.3, y * 0.1, 0));
            }
            break;
        }
    }

    return positions;
}

// Update enemy position based on pattern animation
export function updatePatternPosition(
    enemy: EnemyInstance, 
    time: number, 
    delta: number
): THREE.Vector3 {
    const { pattern, basePosition, patternOffset, amplitude, frequency, phase, radius } = enemy;
    const t = time * enemy.speed + patternOffset + phase;
    
    let newPos = basePosition.clone();
    
    switch (pattern) {
        case 'sine_wave': {
            newPos.y += amplitude * Math.sin(frequency * t);
            break;
        }
        
        case 'spiral': {
            const r = radius + patternOffset * 0.1;
            const theta = t + patternOffset;
            newPos.x += r * Math.cos(theta) * 0.3;
            newPos.y += r * Math.sin(theta) * 0.15;
            break;
        }
        
        case 'figure_eight': {
            newPos.y += amplitude * Math.sin(t);
            newPos.x += amplitude * 0.3 * Math.sin(2 * t);
            break;
        }
        
        case 'lissajous': {
            newPos.x += amplitude * Math.sin(frequency * t + phase);
            newPos.y += amplitude * 0.6 * Math.sin(frequency * 1.5 * t);
            break;
        }
        
        case 'helix': {
            newPos.y += radius * Math.cos(t + patternOffset);
            newPos.z = radius * Math.sin(t + patternOffset);
            break;
        }
        
        case 'ring': {
            const angle = t * 0.5 + patternOffset;
            newPos.x += radius * Math.cos(angle);
            newPos.y += radius * Math.sin(angle);
            break;
        }
        
        case 'cross': {
            newPos.y += amplitude * Math.sin(frequency * t) * (patternOffset % 2 === 0 ? 1 : 0.3);
            break;
        }
        
        case 'v_formation': {
            newPos.y += amplitude * Math.sin(frequency * t + patternOffset);
            break;
        }
        
        case 'diamond': {
            newPos.x += amplitude * 0.3 * Math.cos(t);
            newPos.y += amplitude * 0.3 * Math.sin(t);
            break;
        }
        
        case 'chaos': {
            newPos.y += amplitude * Math.sin(t * 1.3 + patternOffset) * Math.cos(t * 0.7);
            newPos.x += amplitude * 0.2 * Math.sin(t * 2.1);
            break;
        }
    }
    
    return newPos;
}

// Get random pattern with parameters based on difficulty
export function getRandomPattern(
    centerX: number, 
    centerY: number, 
    difficulty: number = 1
): PatternConfig {
    const patterns: PatternType[] = [
        'sine_wave', 'spiral', 'figure_eight', 'lissajous', 
        'helix', 'ring', 'cross', 'v_formation', 'diamond', 'chaos'
    ];
    
    const type = patterns[Math.floor(Math.random() * patterns.length)];
    const count = 5 + Math.floor(Math.random() * 8) + Math.floor(difficulty * 3);
    
    return {
        type,
        centerX,
        centerY,
        count,
        spacing: 2 + Math.random() * 2,
        speed: 0.5 + Math.random() * 1.5 + difficulty * 0.3,
        amplitude: 2 + Math.random() * 4 + difficulty,
        frequency: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        radius: 2 + Math.random() * 4
    };
}

// Get pattern name for debugging
export function getPatternName(type: PatternType): string {
    const names: Record<PatternType, string> = {
        sine_wave: 'Sine Wave',
        spiral: 'Spiral',
        figure_eight: 'Figure Eight',
        lissajous: 'Lissajous',
        helix: 'Helix',
        ring: 'Ring',
        cross: 'Cross',
        v_formation: 'V Formation',
        diamond: 'Diamond',
        chaos: 'Chaos'
    };
    return names[type];
}
