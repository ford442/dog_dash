import * as THREE from 'three';

interface DebrisPiece {
  mesh: THREE.Mesh;
  phase: 'solid' | 'fading' | 'ethereal' | 'reforming';
  phaseTime: number;
  phaseDuration: number;
  basePosition: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
}

export class GhostDebrisSystem {
  private scene: THREE.Scene;
  private debrisPool: DebrisPiece[] = [];
  private time: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.spawnCluster(0, 0, -80); // initial spawn
  }

  private createDebrisPiece(x: number, y: number, z: number): DebrisPiece {
    // Irregular rocky shape: icosahedron + random extrusion
    const geometry = new THREE.IcosahedronGeometry(1.2 + Math.random() * 0.8, 0);
    // Slight random extrusion for organic look
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vy = positions.getY(i);
      const vz = positions.getZ(i);
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
      positions.setXYZ(i, vx * (1 + Math.random() * 0.3), vy * (1 + Math.random() * 0.3), vz * (1 + Math.random() * 0.3));
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      emissive: 0x4488ff,
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.7,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    return {
      mesh,
      phase: 'solid',
      phaseTime: 0,
      phaseDuration: 3 + Math.random() * 1,
      basePosition: mesh.position.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 12
      ),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ),
    };
  }

  private spawnCluster(x: number, y: number, z: number) {
    const count = 8 + Math.floor(Math.random() * 9);
    for (let i = 0; i < count; i++) {
      const piece = this.createDebrisPiece(
        x + (Math.random() - 0.5) * 25,
        y + (Math.random() - 0.5) * 18,
        z + (Math.random() - 0.5) * 12
      );
      this.debrisPool.push(piece);
    }
  }

  update(deltaTime: number) {
    this.time += deltaTime;

    // Spawn new clusters occasionally
    if (Math.random() < 0.008) {
      this.spawnCluster(0, 15 + Math.random() * 20, -120);
    }

    for (let i = this.debrisPool.length - 1; i >= 0; i--) {
      const piece = this.debrisPool[i];
      const mat = piece.mesh.material as THREE.MeshStandardMaterial;

      piece.phaseTime += deltaTime;
      if (piece.phaseTime >= piece.phaseDuration) {
        // Cycle phases
        const phases: DebrisPiece['phase'][] = ['solid', 'fading', 'ethereal', 'reforming'];
        const idx = phases.indexOf(piece.phase);
        piece.phase = phases[(idx + 1) % 4];
        piece.phaseTime = 0;

        switch (piece.phase) {
          case 'solid': piece.phaseDuration = 3 + Math.random() * 1; break;
          case 'fading': piece.phaseDuration = 1; break;
          case 'ethereal': piece.phaseDuration = 2; break;
          case 'reforming': piece.phaseDuration = 1; break;
        }
      }

      // Phase visuals
      switch (piece.phase) {
        case 'solid':
          mat.opacity = 1;
          mat.emissiveIntensity = 0.6;
          // collision would be enabled here (hook into your WASM system)
          break;
        case 'fading':
          mat.opacity = Math.sin(this.time * 8) * 0.3 + 0.4; // simple dither stub
          mat.emissiveIntensity = 0.3;
          break;
        case 'ethereal':
          mat.opacity = 0.15;
          mat.emissiveIntensity = 1.2;
          // collision disabled here
          break;
        case 'reforming':
          mat.opacity = Math.sin(this.time * 12) * 0.4 + 0.6;
          mat.emissiveIntensity = 0.9;
          break;
      }

      // Movement & tumble
      piece.mesh.position.add(piece.velocity.clone().multiplyScalar(deltaTime * 0.8));
      piece.mesh.position.y = piece.basePosition.y + Math.sin(this.time * 1.5 + piece.mesh.position.x) * 4;
      piece.mesh.rotation.x += piece.rotationSpeed.x * deltaTime;
      piece.mesh.rotation.y += piece.rotationSpeed.y * deltaTime;
      piece.mesh.rotation.z += piece.rotationSpeed.z * deltaTime;

      // Remove if too far behind player
      if (piece.mesh.position.z > 30) {
        this.scene.remove(piece.mesh);
        piece.mesh.geometry.dispose();
        (piece.mesh.material as THREE.Material).dispose();
        this.debrisPool.splice(i, 1);
      }
    }
  }

  dispose() {
    this.debrisPool.forEach(piece => {
      this.scene.remove(piece.mesh);
      piece.mesh.geometry.dispose();
      (piece.mesh.material as THREE.Material).dispose();
    });
    this.debrisPool = [];
  }
}
