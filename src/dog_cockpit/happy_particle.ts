import * as THREE from 'three';

export class HappyParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    
    constructor(scene: THREE.Scene, position: THREE.Vector3) {
        const geometry = new THREE.SphereGeometry(0.03, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(Math.random(), 1, 0.6),
            transparent: true,
            opacity: 0.8
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        // Random upward velocity
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            Math.random() * 0.15 + 0.05,
            (Math.random() - 0.5) * 0.1
        );
        
        this.life = 0;
        this.maxLife = 1 + Math.random() * 0.5;
        scene.add(this.mesh);
    }
    
    update(deltaTime: number): boolean {
        this.life += deltaTime;
        this.mesh.position.addScaledVector(this.velocity, deltaTime);
        this.velocity.y -= 0.1 * deltaTime; // Gravity
        
        // Fade out
        const t = this.life / this.maxLife;
        (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
        this.mesh.scale.setScalar(1 - t * 0.5);
        
        if (this.life >= this.maxLife) {
            this.mesh.parent?.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as THREE.Material).dispose();
            return false;
        }
        return true;
    }
}
