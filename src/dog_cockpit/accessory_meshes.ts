import * as THREE from 'three';

export function createTutu(): THREE.Mesh {
        const geometry = new THREE.CylinderGeometry(0.35, 0.4, 0.15, 16, 1, true);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff69b4, // Hot pink
            emissive: 0xff1493,
            emissiveIntensity: 0.2,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const tutu = new THREE.Mesh(geometry, material);
        tutu.name = 'tutu';
        tutu.position.set(0, -0.2, 0);
        
        // Add some sparkles (small spheres around the tutu)
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const sparkle = new THREE.Mesh(
                new THREE.SphereGeometry(0.03, 4, 4),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            sparkle.position.set(Math.cos(angle) * 0.38, 0, Math.sin(angle) * 0.38);
            tutu.add(sparkle);
        }
        
        return tutu;
    }
    
    /** Create a superhero cape */
export function createCape(): THREE.Mesh {
        // Create a curved cape using a plane with segments
        const geometry = new THREE.PlaneGeometry(0.6, 0.8, 4, 6);
        const material = new THREE.MeshStandardMaterial({
            color: 0x4444ff, // Blue
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        });
        
        // Curve the cape
        const positions = geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            // Curve outward
            positions[i + 2] = Math.abs(x) * 0.3 - (y + 0.4) * 0.2;
        }
        geometry.computeVertexNormals();
        
        const cape = new THREE.Mesh(geometry, material);
        cape.name = 'cape';
        cape.position.set(0, 0, -0.25);
        cape.rotation.x = 0.2;
        
        // Add red interior
        const interior = cape.clone();
        interior.material = new THREE.MeshStandardMaterial({
            color: 0xff4444,
            side: THREE.DoubleSide
        });
        interior.scale.set(0.95, 0.95, 0.95);
        cape.add(interior);
        
        return cape;
    }
    
    /** Create a cute bow */
export function createBow(): THREE.Group {
        const group = new THREE.Group();
        group.name = 'bow';
        
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0x880000,
            emissiveIntensity: 0.3
        });
        
        // Left loop
        const leftLoop = new THREE.Mesh(
            new THREE.TorusGeometry(0.08, 0.03, 8, 16, Math.PI * 1.5),
            material
        );
        leftLoop.position.set(-0.08, 0, 0);
        leftLoop.rotation.z = Math.PI / 4;
        group.add(leftLoop);
        
        // Right loop
        const rightLoop = new THREE.Mesh(
            new THREE.TorusGeometry(0.08, 0.03, 8, 16, Math.PI * 1.5),
            material
        );
        rightLoop.position.set(0.08, 0, 0);
        rightLoop.rotation.z = -Math.PI / 4 - Math.PI / 2;
        group.add(rightLoop);
        
        // Center knot
        const knot = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 8),
            material
        );
        group.add(knot);
        
        // Position on head
        group.position.set(0, 0.3, 0.15);
        
        return group;
    }
    
    /** Create cool glasses */
export function createGlasses(): THREE.Group {
        const group = new THREE.Group();
        group.name = 'glasses';
        
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const lensMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x00ffff,
            metalness: 0.9,
            roughness: 0.1,
            transmission: 0.3,
            transparent: true,
            opacity: 0.7
        });
        
        // Left frame
        const leftFrame = new THREE.Mesh(
            new THREE.TorusGeometry(0.06, 0.01, 8, 16),
            frameMaterial
        );
        leftFrame.position.set(-0.08, 0, 0);
        group.add(leftFrame);
        
        // Right frame
        const rightFrame = new THREE.Mesh(
            new THREE.TorusGeometry(0.06, 0.01, 8, 16),
            frameMaterial
        );
        rightFrame.position.set(0.08, 0, 0);
        group.add(rightFrame);
        
        // Bridge
        const bridge = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.01, 0.01),
            frameMaterial
        );
        group.add(bridge);
        
        // Lenses
        const leftLens = new THREE.Mesh(
            new THREE.CircleGeometry(0.055, 16),
            lensMaterial
        );
        leftLens.position.set(-0.08, 0, 0.005);
        group.add(leftLens);
        
        const rightLens = new THREE.Mesh(
            new THREE.CircleGeometry(0.055, 16),
            lensMaterial
        );
        rightLens.position.set(0.08, 0, 0.005);
        group.add(rightLens);
        
        // Position on face
        group.position.set(0, 0.05, 0.18);
        
        return group;
    }
    
    /** Create a sparkly crown */
export function createCrown(): THREE.Group {
        const group = new THREE.Group();
        group.name = 'crown';
        
        const goldMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 1,
            roughness: 0.2,
            emissive: 0xffaa00,
            emissiveIntensity: 0.2
        });
        
        // Base ring
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12),
            goldMaterial
        );
        group.add(base);
        
        // Points
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const pointHeight = i === 0 ? 0.12 : 0.08; // Middle point is tallest
            
            const point = new THREE.Mesh(
                new THREE.ConeGeometry(0.02, pointHeight, 6),
                goldMaterial
            );
            point.position.set(
                Math.cos(angle) * 0.1,
                pointHeight / 2,
                Math.sin(angle) * 0.1
            );
            group.add(point);
            
            // Gem on top
            const gem = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.025),
                new THREE.MeshStandardMaterial({
                    color: 0xff0066,
                    emissive: 0xff0066,
                    emissiveIntensity: 0.5,
                    metalness: 1,
                    roughness: 0.1
                })
            );
            gem.position.set(
                Math.cos(angle) * 0.1,
                pointHeight + 0.02,
                Math.sin(angle) * 0.1
            );
            group.add(gem);
        }
        
        // Position on head
        group.position.set(0, 0.35, 0);
        
        return group;
    }
    
