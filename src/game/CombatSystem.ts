import * as THREE from 'three';
import type { Entity } from './entities/Entity';
import type { EnemyEntity } from '../data/MapEntity';
import { enemyPool, getEnemyCoinReward } from './entities/EnemyPool';
import { addCoins } from '../domain/playerProgress';
import { applyTransform } from './entities/applyTransform';
import { HitParticles } from './effects/HitParticles';
import { ScreenShake } from './effects/ScreenShake';

const HIT_SHAKE_INTENSITY = 0.1;
const HIT_SHAKE_DURATION = 0.15;

export class CombatSystem {
    private enemies: { entity: Entity; source: EnemyEntity }[] = [];

    private sources: EnemyEntity[] = [];
    private hitParticles: HitParticles;
    private screenShake = new ScreenShake();
    private entityGroup: THREE.Group;
    private player: Entity;
    private onKill: (entity: Entity) => void;
    private onSpawn: (entity: Entity) => void;

    private scratchBoxA = new THREE.Box3();
    private scratchBoxB = new THREE.Box3();
    private scratchCenter = new THREE.Vector3();

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

    public clear() {
        this.enemies = [];
        this.sources = [];
    }

    public addEnemy(entity: Entity, source: EnemyEntity) {
        this.enemies.push({ entity, source });
        this.sources.push(source);
    }

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
        const health = entity.getComponent('health');
        if (health) health.hp = health.maxHp;

        entity.getComponent('healthBar')?.reset();
        applyTransform(entity.mesh, source);
        entity.getComponent('enemyAI')?.setOrigin(entity.mesh.position.clone());
    }

    public update(dt: number, camera: THREE.Camera) {
        this.resolveAttack();
        this.resolveEnemyAttacks();
        this.hitParticles.update(dt);
        camera.position.add(this.screenShake.getOffset(dt));
    }

    private resolveEnemyAttacks() {
        const playerHealth = this.player.getComponent('health');
        if (!playerHealth) return;

        const playerBox = this.scratchBoxA.setFromObject(this.player.mesh);

        for (const { entity } of this.enemies) {
            const attack = entity.getComponent('attack');
            if (!attack?.isAttacking) continue;

            const hitbox = attack.getHitbox();
            if (!hitbox || !hitbox.intersectsBox(playerBox)) continue;
            if (!attack.registerHit(this.player.id)) continue;

            playerHealth.takeDamage(attack.damage);
            this.player.getComponent('hitFlash')?.trigger();
            this.hitParticles.spawnBurst(playerBox.getCenter(this.scratchCenter));
            this.screenShake.trigger(HIT_SHAKE_INTENSITY, HIT_SHAKE_DURATION);
        }
    }

    private resolveAttack() {
        const attack = this.player.getComponent('attack');
        if (!attack?.isAttacking) return;

        const hitbox = attack.getHitbox();
        if (!hitbox) return;

        for (const { entity, source } of this.enemies) {
            const enemyBox = this.scratchBoxB.setFromObject(entity.mesh);
            if (!hitbox.intersectsBox(enemyBox)) continue;
            if (!attack.registerHit(entity.id)) continue;

            const health = entity.getComponent('health');
            health?.takeDamage(attack.damage);

            entity.getComponent('hitFlash')?.trigger();
            this.hitParticles.spawnBurst(enemyBox.getCenter(this.scratchCenter));
            this.screenShake.trigger(HIT_SHAKE_INTENSITY, HIT_SHAKE_DURATION);

            if (health?.isDead()) this.killEnemy(entity, source);
        }
    }

    private killEnemy(entity: Entity, source: EnemyEntity) {
        this.entityGroup.remove(entity.mesh);
        this.enemies = this.enemies.filter((e) => e.entity !== entity);
        enemyPool.release(entity, source.enemyType);
        addCoins(getEnemyCoinReward(source.enemyType));
        this.onKill(entity);
    }
}
