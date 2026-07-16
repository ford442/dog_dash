import * as THREE from 'three';
import { NebulaKraken } from '../space_robot_squid';
import { getCandyScoreBonus, type CandyAsteroidVariant } from '../candy_materials';
import { splitAsteroid, triggerCandySquash } from './spawn_pools';
import type { ObstacleSystemHost } from './host';

export function handleSquidCollision(host: ObstacleSystemHost, squid: NebulaKraken) {
        const player = host.options.getPlayer();
        if (!player) return;

        // Squid collision deals damage to player
        host.options.particleSystem.emit(
            player.position.clone(), 0x9900ff, 20, 8.0, 1.2, 1.5
        );

        // The squid also takes some damage from ramming
        squid.takeDamage(25);

        host.options.playerState.health--;
        host.options.playerState.invincible = true;

        // Visual flash on player rocket
        const rocket = player.children[0];
        if (rocket) {
            rocket.children.forEach((child: any) => {
                if (child.material) {
                    const originalColor = child.material.color.clone();
                    child.material.color.setHex(0x9900ff); // Purple flash
                    setTimeout(() => {
                        if (child.material) {
                            child.material.color.copy(originalColor);
                        }
                    }, 200);
                }
            });
        }

        setTimeout(() => {
            host.options.playerState.invincible = false;
        }, 2000);

        host.options.updateHealthDisplay();
        if (host.options.playerState.health <= 0) {
            host.options.gameOver();
        }

        // Knockback from squid
        const dy = squid.getPosition().y - player.position.y;
        host.options.playerState.velocity.y += (dy > 0 ? -8 : 8);
        host.options.playerState.velocity.x -= 5;
    }
export function handleCollision(host: ObstacleSystemHost, obs: THREE.Mesh) {
        if (!obs) return;
        const player = host.options.getPlayer();
        const playerY = player ? player.position.y : 0;
        host.options.particleSystem.emit(obs.position.clone(), 0xff5555, 15, 10.0, 1.2, 1.0);
        if (host.options.getCurrentLevel() === 6) {
            host.options.waterfallSystem.triggerSplash(obs.position, 30);
        }

        splitAsteroid(host, obs);
        host.options.playerState.health--;
        host.options.playerState.invincible = true;

        if (player) {
            const rocket = player.children[0];
            if (rocket) {
                rocket.children.forEach((child: any) => {
                    if (child.material) {
                        const originalColor = child.material.color.clone();
                        child.material.color.setHex(0xff0000);
                        setTimeout(() => {
                            if (child.material) {
                                child.material.color.copy(originalColor);
                            }
                        }, 200);
                    }
                });
            }
        }

        setTimeout(() => {
            host.options.playerState.invincible = false;
        }, 2000);

        if (host.options.onPlayerHit) {
            host.options.onPlayerHit();
        }
        host.options.updateHealthDisplay();
        if (host.options.playerState.health <= 0) {
            host.options.gameOver();
        }

        const dy = obs.position.y - playerY;
        host.options.playerState.velocity.y += (dy > 0 ? -5 : 5);
        host.options.playerState.velocity.x -= 3;
    }
export function handleBounce(host: ObstacleSystemHost, asteroid: THREE.Mesh) {
        if (!asteroid) return;
        const player = host.options.getPlayer();
        if (!player) return;

        host.bounceCooldown = 0.25;

        // Bounce asteroid away from player
        const dx = asteroid.position.x - player.position.x;
        const dy = asteroid.position.y - player.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const bounceSpeed = 12 + Math.random() * 8;

        asteroid.userData.velocity = new THREE.Vector3(
            (dx / dist) * bounceSpeed + 3,
            (dy / dist) * bounceSpeed,
            (Math.random() - 0.5) * 6
        );

        // Spin it wildly
        asteroid.userData.rotationSpeed = (Math.random() - 0.5) * 15;
        asteroid.userData.rotationSpeedY = (Math.random() - 0.5) * 10;
        asteroid.userData.rotationSpeedZ = (Math.random() - 0.5) * 10;

        // Pink sparkle burst at bounce point
        host.options.particleSystem.emit(
            asteroid.position.clone(),
            0xff69b4,
            12,
            6.0,
            0.8,
            0.8
        );
        if (asteroid.userData.isCandyAsteroid) {
            triggerCandySquash(host, asteroid, 1.4);
        }
        // Secondary white sparkle
        host.options.particleSystem.emit(
            asteroid.position.clone(),
            0xffffff,
            6,
            4.0,
            0.5,
            0.5
        );

        // Callback for audio + floating text
        if (host.options.onAsteroidBounce) {
            host.options.onAsteroidBounce(asteroid);
        }
    }

/** Near-miss graze scoring and visual streaks. */
export function processGrazeDetection(
    host: ObstacleSystemHost,
    activeObstacles: THREE.Mesh[],
    player: THREE.Group,
    playerX: number,
    playerY: number,
    delta: number
): void {
    const grazeMaxDist = host.GRAZE_MAX_DIST + host.grazeWindowBonusDist;
    for (const obs of activeObstacles) {
        const dx = obs.position.x - playerX;
        const dy = obs.position.y - playerY;
        const centerDist = Math.sqrt(dx * dx + dy * dy);
        const asteroidRadius = obs.userData.radius || 1.0;
        const playerRadius = 0.5;
        const edgeDist = centerDist - playerRadius - asteroidRadius;

        if (edgeDist <= 0) continue;
        if (edgeDist < host.GRAZE_MIN_DIST || edgeDist > grazeMaxDist) continue;

        const cd = host.grazeCooldowns.get(obs) || 0;
        if (cd > 0) continue;
        host.grazeCooldowns.set(obs, host.GRAZE_COOLDOWN);

        if (host.time - host.lastGrazeTime > host.GRAZE_COMBO_TIMEOUT) {
            host.grazeCombo = 0;
        }
        host.grazeCombo++;
        host.lastGrazeTime = host.time;
        host.grazeCount++;

        const modifiers = host.options.getPowerUpModifiers
            ? host.options.getPowerUpModifiers()
            : { shieldActive: false, shieldBouncesAsteroids: false };
        let score = modifiers.shieldActive || modifiers.shieldBouncesAsteroids ? 50 : 25;
        if (obs.userData.isCandyAsteroid) {
            score += getCandyScoreBonus(obs.userData.candyVariant as CandyAsteroidVariant);
        }
        score = Math.floor(score * (1 + (host.grazeCombo - 1) * 0.2));

        const midPoint = new THREE.Vector3(
            (playerX + obs.position.x) * 0.5,
            (playerY + obs.position.y) * 0.5,
            (player.position.z + obs.position.z) * 0.5
        );
        host.options.particleSystem.emit(midPoint, 0x00ffff, 3, 4.0, 0.5, 0.3);
        host.options.particleSystem.emit(midPoint, 0xffffff, 2, 3.0, 0.4, 0.2);

        host.options.onGraze?.(obs, score, host.grazeCombo);
    }

    for (const [obs, cd] of host.grazeCooldowns) {
        const newCd = cd - delta;
        if (newCd <= 0 || !host.obstacles.includes(obs)) {
            host.grazeCooldowns.delete(obs);
        } else {
            host.grazeCooldowns.set(obs, newCd);
        }
    }
}
