import * as THREE from 'three';
import type { Entity } from './entities/Entity';
import type { EnemyEntity } from '../data/MapEntity';
import type { AttackComponent } from './entities/components/AttackComponent';
import type { HitFlashComponent } from './entities/components/HitFlashComponent';
import { HealthComponent } from '../domain/components/HealthComponent';
import { enemyPool } from './entities/EnemyPool';
import { HitParticles } from './effects/HitParticles';
import { ScreenShake } from './effects/ScreenShake';

const HIT_SHAKE_INTENSITY = 0.1;
const HIT_SHAKE_DURATION = 0.15;

// Owns enemy-vs-player combat resolution and its visual feedback (hit particles, screen
// shake, damage flash) so World stays a scene/entity registry rather than a combat engine.
export class CombatSystem {
    private enemies: { entity: Entity; source: EnemyEntity }[] = [];
    private hitParticles: HitParticles;
    private screenShake = new ScreenShake();
    private entityGroup: THREE.Group;
    private player: Entity;
    private onKill: (entity: Entity) => void;

    constructor(entityGroup: THREE.Group, player: Entity, onKill: (entity: Entity) => void) {
        this.entityGroup = entityGroup;
        this.player = player;
        this.onKill = onKill;
        this.hitParticles = new HitParticles(entityGroup);
    }

    public addEnemy(entity: Entity, source: EnemyEntity) {
        this.enemies.push({ entity, source });
    }

    public update(dt: number, camera: THREE.Camera) {
        this.resolveAttack();
        this.resolveEnemyAttacks();
        this.hitParticles.update(dt);
        camera.position.add(this.screenShake.getOffset(dt));
    }

    private resolveEnemyAttacks() {
        const playerHealth = this.player.getComponent<HealthComponent>('health');
        if (!playerHealth) return;

        const playerBox = new THREE.Box3().setFromObject(this.player.mesh);

        for (const { entity } of this.enemies) {
            const attack = entity.getComponent<AttackComponent>('attack');
            if (!attack?.isAttacking) continue;

            const hitbox = attack.getHitbox();
            if (!hitbox || !hitbox.intersectsBox(playerBox)) continue;
            if (!attack.registerHit(this.player.id)) continue;

            playerHealth.takeDamage(attack.damage);
            this.player.getComponent<HitFlashComponent>('hitFlash')?.trigger();
            this.hitParticles.spawnBurst(playerBox.getCenter(new THREE.Vector3()));
            this.screenShake.trigger(HIT_SHAKE_INTENSITY, HIT_SHAKE_DURATION);
        }
    }

    private resolveAttack() {
        const attack = this.player.getComponent<AttackComponent>('attack');
        if (!attack?.isAttacking) return;

        const hitbox = attack.getHitbox();
        if (!hitbox) return;

        for (const { entity, source } of this.enemies) {
            const enemyBox = new THREE.Box3().setFromObject(entity.mesh);
            if (!hitbox.intersectsBox(enemyBox)) continue;
            if (!attack.registerHit(entity.id)) continue;

            const health = entity.getComponent<HealthComponent>('health');
            health?.takeDamage(attack.damage);

            entity.getComponent<HitFlashComponent>('hitFlash')?.trigger();
            this.hitParticles.spawnBurst(enemyBox.getCenter(new THREE.Vector3()));
            this.screenShake.trigger(HIT_SHAKE_INTENSITY, HIT_SHAKE_DURATION);

            if (health?.isDead()) this.killEnemy(entity, source);
        }
    }

    private killEnemy(entity: Entity, source: EnemyEntity) {
        this.entityGroup.remove(entity.mesh);
        this.enemies = this.enemies.filter((e) => e.entity !== entity);
        enemyPool.release(entity, source.enemyType);
        this.onKill(entity);
    }
}
