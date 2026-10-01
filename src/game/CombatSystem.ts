import * as THREE from 'three';
import type { Entity } from './entities/Entity';
import type { EnemyEntity } from '../data/MapEntity';
import { enemyPool, getEnemyCoinReward } from './entities/EnemyPool';
import { addCoins } from '../domain/playerProgress';
import { defeatBoss } from '../domain/defeatedBosses';
import { chunkKeyAt, type ChunkKey } from '../domain/chunks';
import { ParticleSystem } from './effects/ParticleSystem';
import { ScreenShake } from './effects/ScreenShake';

const HIT_SHAKE_INTENSITY = 0.1;
const HIT_SHAKE_DURATION = 0.15;

export class CombatSystem {
    private enemies: { entity: Entity; source: EnemyEntity }[] = [];

    private sources: EnemyEntity[] = [];
    private hitParticles: ParticleSystem;
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
        this.hitParticles = new ParticleSystem(entityGroup);
    }

    public clear() {
        this.enemies = [];
        this.sources = [];
    }

    public addEnemy(entity: Entity, source: EnemyEntity) {
        this.enemies.push({ entity, source });
        this.sources.push(source);
    }

    /** Stops tracking a live enemy whose mesh is going away. */
    public removeEnemy(entity: Entity) {
        this.enemies = this.enemies.filter((e) => e.entity !== entity);
    }

    /**
     * Forgets every enemy authored in an unloading chunk, dead ones included.
     * A killed enemy has no entity left in the chunk to remove, so dropping
     * sources only through `removeEnemy` kept it here — and the next rest then
     * revived it into a chunk the streamer believed unloaded, which duplicated
     * it once the player walked back. The chunk is derived from the authored
     * position, the same rule `bucketByChunk` uses to load it.
     */
    public forgetChunk(key: ChunkKey) {
        this.sources = this.sources.filter((source) => chunkKeyAt(source.position[0], source.position[2]) !== key);
    }

    public resetEnemies() {
        for (const source of this.sources) {
            if (source.enemyType === 'boss') continue;

            const live = this.enemies.find((e) => e.source === source);
            if (live) {
                enemyPool.reset(live.entity, source);
            } else {
                const entity = enemyPool.acquire(source);
                this.entityGroup.add(entity.mesh);
                this.enemies.push({ entity, source });
                this.onSpawn(entity);
            }
        }
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

        const playerBox = hurtbox(this.player, this.scratchBoxA);

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
            const enemyBox = hurtbox(entity, this.scratchBoxB);
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
        if (source.enemyType === 'boss') defeatBoss(source.id);
        addCoins(getEnemyCoinReward(source.enemyType));
        this.onKill(entity);
    }
}

/**
 * The box combat tests against: the body's own footprint and height. Measuring
 * the mesh instead (`Box3.setFromObject`) walked the whole hierarchy every
 * frame and counted whatever hung off it — an enemy's health bar widened its
 * hurtbox, a swung sword stretched the player's.
 */
function hurtbox(entity: Entity, target: THREE.Box3): THREE.Box3 {
    const radius = entity.collisionRadius;
    const height = entity.bodyHeight;
    if (radius === undefined || height === undefined) return target.setFromObject(entity.mesh);

    const { x, y, z } = entity.mesh.position;
    const feet = y - entity.groundOffset;
    target.min.set(x - radius, feet, z - radius);
    target.max.set(x + radius, feet + height, z + radius);
    return target;
}
