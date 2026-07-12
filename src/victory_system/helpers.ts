import * as THREE from 'three';

// =============================================================================
// STANDALONE FUNCTIONS
// =============================================================================

/**
 * Create spectacular victory fireworks at a position
 */
export function createVictoryFireworks(position: THREE.Vector3, scene: THREE.Scene, parent?: THREE.Group): void {
    const colors = [0xFFD700, 0xFF69B4, 0x9370DB, 0x00CED1, 0x98FB98];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Create explosion burst
    const particleCount = 30;
    const geometries = [
        new THREE.SphereGeometry(0.1, 4, 4),
        new THREE.ConeGeometry(0.1, 0.3, 4),
        new THREE.TetrahedronGeometry(0.15)
    ];
    
    const container = parent || scene;
    
    // Create heart shape particles
    for (let i = 0; i < particleCount; i++) {
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        
        // Explosive velocity in sphere pattern
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 5 + Math.random() * 10;
        
        const velocity = new THREE.Vector3(
            speed * Math.sin(phi) * Math.cos(theta),
            speed * Math.sin(phi) * Math.sin(theta),
            speed * Math.cos(phi)
        );
        
        container.add(mesh);
        
        // Animate and remove
        const life = 1 + Math.random() * 0.5;
        let elapsed = 0;
        
        const animate = () => {
            elapsed += 0.016;
            if (elapsed >= life) {
                container.remove(mesh);
                geometry.dispose();
                material.dispose();
                return;
            }
            
            // Move
            velocity.y -= 9.8 * 0.016; // Gravity
            mesh.position.add(velocity.clone().multiplyScalar(0.016));
            mesh.rotation.x += 0.1;
            mesh.rotation.y += 0.1;
            
            // Fade
            material.opacity = 0.9 * (1 - elapsed / life);
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    // Add sparkle rings
    for (let ring = 0; ring < 3; ring++) {
        setTimeout(() => {
            const ringGeometry = new THREE.RingGeometry(0.5 + ring * 0.5, 0.7 + ring * 0.5, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: colors[(colors.indexOf(color) + ring) % colors.length],
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            
            const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
            ringMesh.position.copy(position);
            ringMesh.lookAt(position.clone().add(new THREE.Vector3(0, 1, 0)));
            container.add(ringMesh);
            
            // Expand and fade
            let ringElapsed = 0;
            const ringLife = 1;
            
            const animateRing = () => {
                ringElapsed += 0.016;
                if (ringElapsed >= ringLife) {
                    container.remove(ringMesh);
                    ringGeometry.dispose();
                    ringMaterial.dispose();
                    return;
                }
                
                const scale = 1 + ringElapsed * 5;
                ringMesh.scale.setScalar(scale);
                ringMaterial.opacity = 0.6 * (1 - ringElapsed / ringLife);
                
                requestAnimationFrame(animateRing);
            };
            
            animateRing();
        }, ring * 100);
    }
}

/**
 * Create magical star rain effect
 */
export function createStarRain(scene: THREE.Scene, parent?: THREE.Group, center?: THREE.Vector3): void {
    const container = parent || scene;
    const centerPos = center || new THREE.Vector3();
    
    const starGeometry = new THREE.OctahedronGeometry(0.2, 0);
    const starCount = 50;
    
    for (let i = 0; i < starCount; i++) {
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 1, 0.7);
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const star = new THREE.Mesh(starGeometry, material);
        
        // Start high up
        star.position.set(
            centerPos.x + (Math.random() - 0.5) * 40,
            centerPos.y + 30 + Math.random() * 20,
            centerPos.z + (Math.random() - 0.5) * 20
        );
        
        star.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        container.add(star);
        
        // Animate falling
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            -5 - Math.random() * 5,
            (Math.random() - 0.5) * 2
        );
        
        const rotSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        );
        
        let life = 5 + Math.random() * 5;
        const twinklePhase = Math.random() * Math.PI * 2;
        
        const animate = () => {
            life -= 0.016;
            if (life <= 0 || star.position.y < centerPos.y - 10) {
                container.remove(star);
                return;
            }
            
            // Move
            star.position.add(velocity.clone().multiplyScalar(0.016));
            
            // Rotate
            star.rotation.x += rotSpeed.x * 0.016;
            star.rotation.y += rotSpeed.y * 0.016;
            star.rotation.z += rotSpeed.z * 0.016;
            
            // Twinkle
            const twinkle = 0.5 + Math.sin(Date.now() * 0.005 + twinklePhase) * 0.5;
            material.opacity = 0.5 + twinkle * 0.5;
            
            requestAnimationFrame(animate);
        };
        
        // Stagger start
        setTimeout(() => animate(), Math.random() * 3000);
    }
    
    // Continuously spawn new stars
    const spawnInterval = setInterval(() => {
        if (!container.parent && container !== scene) {
            clearInterval(spawnInterval);
            return;
        }
        
        const hue = Math.random();
        const color = new THREE.Color().setHSL(hue, 1, 0.7);
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const star = new THREE.Mesh(starGeometry, material);
        star.position.set(
            centerPos.x + (Math.random() - 0.5) * 40,
            centerPos.y + 30 + Math.random() * 10,
            centerPos.z + (Math.random() - 0.5) * 20
        );
        
        container.add(star);
        
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            -5 - Math.random() * 5,
            (Math.random() - 0.5) * 2
        );
        
        let life = 5 + Math.random() * 5;
        
        const animate = () => {
            life -= 0.016;
            if (life <= 0 || star.position.y < centerPos.y - 10) {
                container.remove(star);
                return;
            }
            
            star.position.add(velocity.clone().multiplyScalar(0.016));
            star.rotation.x += 0.05;
            star.rotation.y += 0.05;
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }, 200);
}

/**
 * Create a floating thank-you note from the moon palace
 */
export function createThankYouNote(position: THREE.Vector3, message: string): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(position);
    
    // Paper background
    const paperGeometry = new THREE.PlaneGeometry(2, 1.2);
    const paperMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFACD,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
    });
    const paper = new THREE.Mesh(paperGeometry, paperMaterial);
    group.add(paper);
    
    // Decorative border
    const borderGeometry = new THREE.RingGeometry(0.9, 1.0, 32);
    const borderMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFD700,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.scale.set(2.2, 1.3, 1);
    group.add(border);
    
    // Sparkle decorations
    for (let i = 0; i < 4; i++) {
        const sparkleGeometry = new THREE.OctahedronGeometry(0.1, 0);
        const sparkleMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFD700,
            transparent: true,
            opacity: 0.8
        });
        const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
        sparkle.position.set(
            (i % 2 === 0 ? 1 : -1) * 0.9,
            (i < 2 ? 0.5 : -0.5),
            0.05
        );
        group.add(sparkle);
    }
    
    // Create text texture using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    // Background
    ctx.fillStyle = '#FFFACD';
    ctx.fillRect(0, 0, 256, 128);
    
    // Text
    ctx.fillStyle = '#8B4513';
    ctx.font = 'bold 24px "Comic Sans MS", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Word wrap
    const words = message.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 220 && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);
    
    const lineHeight = 28;
    const startY = 64 - ((lines.length - 1) * lineHeight) / 2;
    
    lines.forEach((line, i) => {
        ctx.fillText(line, 128, startY + i * lineHeight);
    });
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9
    });
    const textPlane = new THREE.Mesh(paperGeometry, textMaterial);
    textPlane.position.z = 0.01;
    group.add(textPlane);
    
    return group;
}

// Add CSS animation for buttons
const style = document.createElement('style');
style.textContent = `
    @keyframes victory-button-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
    }
`;
document.head.appendChild(style);
