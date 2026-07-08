import { InstancedBufferAttribute as StorageBufferAttribute } from 'three';
import { storage } from 'three/tsl';
import { Projectile } from './weapons';

export class WeaponLightManager {
    buffer: StorageBufferAttribute;
    storageNode: any;
    count: number = 20; // Matches WeaponSystem pool size

    constructor() {
        // x, y, z, intensity (w)
        const data = new Float32Array(this.count * 4);
        this.buffer = new StorageBufferAttribute(data, 4);
        this.storageNode = storage(this.buffer, 'vec4', this.count);
    }

    update(projectiles: Projectile[]) {
        const count = Math.min(projectiles.length, this.count);

        for (let i = 0; i < this.count; i++) {
            if (i < count) {
                const p = projectiles[i];
                this.buffer.setXYZW(i, p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 2.0); // Boosted intensity
            } else {
                // Inactive - set intensity to 0
                this.buffer.setW(i, 0.0);
            }
        }
    }
}
