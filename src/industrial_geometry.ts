import * as THREE from 'three';

const PISTON_SPAWN_CHANCE = 0.4;
const BLAST_DOOR_SPAWN_CHANCE = 0.6;

export class IndustrialGeometryManager {
    private readonly scene: THREE.Scene;
    private readonly pistons: THREE.Group[] = [];
    private readonly blastDoors: THREE.Group[] = [];
    private readonly whaleRibSections: THREE.Group[] = [];
    private readonly barnacles: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    createIndustrialSection(xPos: number): THREE.Group {
        const group = new THREE.Group();
        const sectionLength = 20;
        const tunnelHeight = 15;

        const rustedMetalMat = new THREE.MeshStandardMaterial({
            color: 0x664422,
            roughness: 0.9,
            metalness: 0.8
        });

        const seamMat = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            emissive: 0xff4400,
            emissiveIntensity: 3.0
        });

        const floorGeo = new THREE.BoxGeometry(sectionLength, 0.5, 10);
        const floor = new THREE.Mesh(floorGeo, rustedMetalMat);
        floor.position.set(0, -tunnelHeight / 2, 0);
        floor.receiveShadow = true;
        group.add(floor);

        const ceiling = new THREE.Mesh(floorGeo, rustedMetalMat);
        ceiling.position.set(0, tunnelHeight / 2, 0);
        ceiling.receiveShadow = true;
        group.add(ceiling);

        const seamGeo = new THREE.BoxGeometry(sectionLength, 0.1, 0.1);
        for (const z of [-4.5, 4.5]) {
            const seam = new THREE.Mesh(seamGeo, seamMat);
            seam.position.set(0, -tunnelHeight / 2 + 0.3, z);
            group.add(seam);
        }

        const obstacleChance = Math.random();
        if (obstacleChance < PISTON_SPAWN_CHANCE) {
            const piston = this.createPiston(0, tunnelHeight);
            group.add(piston);
            this.pistons.push(piston);
        } else if (obstacleChance < BLAST_DOOR_SPAWN_CHANCE) {
            const door = this.createBlastDoor(sectionLength / 2, tunnelHeight);
            group.add(door);
            this.blastDoors.push(door);
        }

        const wallPanelGeo = new THREE.BoxGeometry(0.2, tunnelHeight * 0.8, 8);
        for (let i = 0; i < 3; i++) {
            const panel = new THREE.Mesh(wallPanelGeo, rustedMetalMat);
            panel.position.set(-sectionLength / 2 + i * sectionLength / 3, 0, -5);
            group.add(panel);
        }

        group.position.x = xPos;
        group.userData = {
            type: 'industrialSection',
            sectionLength
        };

        this.scene.add(group);
        return group;
    }

    createWhaleRibSection(xPos: number): THREE.Group {
        const group = new THREE.Group();
        const sectionLength = 25;
        const ribHeight = 20;

        const boneMat = new THREE.MeshStandardMaterial({
            color: 0xddc8a8,
            roughness: 0.85,
            metalness: 0.05,
            emissive: 0x221100,
            emissiveIntensity: 0.1
        });

        const ribCount = 3;
        for (let i = 0; i < ribCount; i++) {
            const ribOffset = (i - 1) * (sectionLength / 3);

            const leftRib = this.createRibBone(ribHeight, true);
            leftRib.position.set(ribOffset, 0, -8);
            leftRib.rotation.y = Math.PI / 2;
            group.add(leftRib);

            const rightRib = this.createRibBone(ribHeight, false);
            rightRib.position.set(ribOffset, 0, 8);
            rightRib.rotation.y = -Math.PI / 2;
            group.add(rightRib);
        }

        const barnacleCount = 8 + Math.floor(Math.random() * 8);
        for (let i = 0; i < barnacleCount; i++) {
            const barnacle = this.createBarnacle();
            barnacle.position.set(
                (Math.random() - 0.5) * sectionLength,
                (Math.random() - 0.5) * ribHeight * 0.8,
                (Math.random() > 0.5 ? -7 : 7) + (Math.random() - 0.5) * 2
            );
            group.add(barnacle);
            this.barnacles.push(barnacle);
        }

        const spineGeo = new THREE.CylinderGeometry(1.5, 1.5, sectionLength, 12);
        const spine = new THREE.Mesh(spineGeo, boneMat);
        spine.rotation.z = Math.PI / 2;
        spine.position.y = -ribHeight / 2;
        group.add(spine);

        group.position.x = xPos;
        group.userData = {
            type: 'whaleRibSection',
            sectionLength
        };

        this.scene.add(group);
        this.whaleRibSections.push(group);
        return group;
    }

    update(time: number) {
        this.updatePistons(time);
        this.updateBlastDoors(time);
    }

    private createPiston(xOffset: number, tunnelHeight: number): THREE.Group {
        const group = new THREE.Group();
        const baseGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 16);
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.7,
            metalness: 0.9
        });
        const base = new THREE.Mesh(baseGeo, metalMat);
        base.position.y = tunnelHeight / 2 - 0.25;
        group.add(base);

        const shaftGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 12);
        const shaft = new THREE.Mesh(shaftGeo, metalMat);
        shaft.position.y = tunnelHeight / 2 - 2.5;
        group.add(shaft);

        const headGeo = new THREE.CylinderGeometry(1, 1, 0.8, 16);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xcc4400,
            roughness: 0.6,
            metalness: 0.8,
            emissive: 0x331100,
            emissiveIntensity: 0.3
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = tunnelHeight / 2 - 5;
        group.add(head);

        group.position.x = xOffset;
        group.userData = {
            type: 'piston',
            baseY: tunnelHeight / 2 - 5,
            stroke: 3,
            cycleSpeed: Math.PI,
            phase: Math.random() * Math.PI * 2,
            head,
            shaft
        };

        return group;
    }

    private createBlastDoor(xOffset: number, tunnelHeight: number): THREE.Group {
        const group = new THREE.Group();
        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.8,
            metalness: 0.7
        });

        const topFrameGeo = new THREE.BoxGeometry(1, 1, 8);
        const topFrame = new THREE.Mesh(topFrameGeo, frameMat);
        topFrame.position.set(0, tunnelHeight / 2 - 0.5, 0);
        group.add(topFrame);

        const doorMat = new THREE.MeshStandardMaterial({
            color: 0x663333,
            roughness: 0.9,
            metalness: 0.6,
            emissive: 0x220000,
            emissiveIntensity: 0.2
        });

        const doorGeo = new THREE.BoxGeometry(0.5, tunnelHeight / 2 - 1, 6);
        const topDoor = new THREE.Mesh(doorGeo, doorMat);
        topDoor.position.set(0, tunnelHeight / 4, 0);
        group.add(topDoor);

        const bottomDoor = new THREE.Mesh(doorGeo, doorMat);
        bottomDoor.position.set(0, -tunnelHeight / 4, 0);
        group.add(bottomDoor);

        const lightGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const lightMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 2.0
        });
        const warningLight = new THREE.Mesh(lightGeo, lightMat);
        warningLight.position.set(0, tunnelHeight / 2 - 1.5, 4);
        group.add(warningLight);

        group.position.x = xOffset;
        group.userData = {
            type: 'blastDoor',
            isOpen: false,
            openProgress: 0,
            topDoor,
            bottomDoor,
            warningLight,
            tunnelHeight
        };

        return group;
    }

    private createRibBone(height: number, isLeft: boolean): THREE.Group {
        const group = new THREE.Group();
        const boneMat = new THREE.MeshStandardMaterial({
            color: 0xddc8a8,
            roughness: 0.85,
            metalness: 0.05
        });

        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, -height / 2, 0),
            new THREE.Vector3(isLeft ? 3 : -3, 0, 0),
            new THREE.Vector3(0, height / 2, 0)
        );

        const ribGeo = new THREE.TubeGeometry(curve, 20, 0.8, 8, false);
        const rib = new THREE.Mesh(ribGeo, boneMat);
        rib.castShadow = true;
        group.add(rib);

        for (let i = 0; i < 3; i++) {
            const t = (i + 1) / 4;
            const point = curve.getPoint(t);
            const protrusionGeo = new THREE.ConeGeometry(0.3, 1.5, 6);
            const protrusion = new THREE.Mesh(protrusionGeo, boneMat);
            protrusion.position.copy(point);
            protrusion.position.z += (isLeft ? -0.5 : 0.5);
            protrusion.rotation.x = isLeft ? -Math.PI / 4 : Math.PI / 4;
            group.add(protrusion);
        }

        return group;
    }

    private createBarnacle(): THREE.Mesh {
        const size = 0.3 + Math.random() * 0.5;
        const barnacleGeo = new THREE.DodecahedronGeometry(size, 0);
        const barnacleMat = new THREE.MeshStandardMaterial({
            color: 0x556677,
            roughness: 0.95,
            metalness: 0.1,
            emissive: 0x223344,
            emissiveIntensity: 0.2
        });

        const barnacle = new THREE.Mesh(barnacleGeo, barnacleMat);
        barnacle.castShadow = true;
        barnacle.userData = {
            type: 'barnacle',
            hasMemoryFragment: Math.random() < 0.3,
            collected: false
        };

        return barnacle;
    }

    private updatePistons(time: number) {
        this.pistons.forEach(piston => {
            if (!piston.userData || piston.userData.type !== 'piston') return;
            const data = piston.userData;
            const phase = time * data.cycleSpeed + data.phase;
            const offset = Math.sin(phase) * data.stroke;
            if (data.head) {
                data.head.position.y = data.baseY + offset;
            }
            if (data.shaft) {
                const shaftLength = 4 + offset;
                data.shaft.scale.y = shaftLength / 4;
                data.shaft.position.y = data.baseY + offset / 2 + 2.5;
            }
        });
    }

    private updateBlastDoors(time: number) {
        this.blastDoors.forEach(door => {
            if (!door.userData || door.userData.type !== 'blastDoor') return;
            const data = door.userData;
            if (data.warningLight) {
                const pulse = Math.sin(time * 4) * 0.5 + 0.5;
                const mat = data.warningLight.material as THREE.MeshStandardMaterial;
                mat.emissiveIntensity = 1.0 + pulse * 2.0;
            }
        });
    }
}
