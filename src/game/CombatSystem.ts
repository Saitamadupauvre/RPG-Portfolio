import * as THREE from 'three';
import type { Entity } from './entities/Entity';
import type { EnemyEntity } from '../data/MapEntity';
import type { AttackComponent } from './entities/components/AttackComponent';
import type { HitFlashComponent } from './entities/components/HitFlashComponent';
import { HealthComponent } from '../domain/components/HealthComponent';
import type { EnemyAIComponent } from './entities/components/EnemyAIComponent';
import type { HealthBarComponent } from './entities/components/HealthBarComponent';
import { enemyPool } from './entities/EnemyPool';
import { applyTransform } from './entities/applyTransform';
import { HitParticles } from './effects/HitParticles';
import { ScreenShake } from './effects/ScreenShake';

const HIT_SHAKE_INTENSITY = 0.1;
const HIT_SHAKE_DURATION = 0.15;

// Owns enemy-vs-player combat resolution and its visual feedback (hit particles, screen
// shake, damage flash) so World stays a scene/entity registry rather than a combat engine.
export class CombatSystem {
    private enemies: { entity: Entity; source: EnemyEntity }[] = [];
    // Every enemy ever registered, alive or dead — bonfire rest rebuilds the world from this.
    private sources: EnemyEntity[] = [];
    private hitParticles: HitParticles;
    private screenShake = new ScreenShake();
    private entityGroup: THREE.Group;
    private player: Entity;
    private onKill: (entity: Entity) => void;
    private onSpawn: (entity: Entity) => void;

    constructor(
        entityGroup: THREE.Group,
        player: Entity,
        onKill: (entity: Entity) => void,
        onSpawn: (entity: Entity) => void,
    ) {
        this.entityGroup = entityGroup;
        this.player = player;
        this.onKill = onKill;
        this.onSpawn = onSpawn;
        this.hitParticles = new HitParticles(entityGroup);
    }

    // Editor reloads swap the whole level, so the enemy registry has to be emptied with it.
    public clear() {
        this.enemies = [];
        this.sources = [];
    }

    public addEnemy(entity: Entity, source: EnemyEntity) {
        this.enemies.push({ entity, source });
        this.sources.push(source);
    }

    // Souls rule: resting restores the world. Bosses stay dead, everything else comes back
    // to full hp at its authored origin — living enemies are reset in place rather than
    // recreated, so no pool churn and no duplicate entities.
    public resetEnemies() {
        for (const source of this.sources) {
            if (source.enemyType === 'boss') continue;

            const live = this.enemies.find((e) => e.source === source);
            if (live) {
                this.resetEnemy(live.entity, source);
            } else {
                const entity = enemyPool.acquire(source);
                this.entityGroup.add(entity.mesh);
                this.enemies.push({ entity, source });
                this.onSpawn(entity);
            }
        }
    }

    private resetEnemy(entity: Entity, source: EnemyEntity) {
        const health = entity.getComponent<HealthComponent>('health');
        if (health) health.hp = health.maxHp;

        entity.getComponent<HealthBarComponent>('healthBar')?.reset();
        applyTransform(entity.mesh, source);
        entity.getComponent<EnemyAIComponent>('enemyAI')?.setOrigin(entity.mesh.position.clone());
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
