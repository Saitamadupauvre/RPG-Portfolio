import * as THREE from 'three';
import type { Entity } from './entities/Entity';
import type { EnemyEntity } from '../data/MapEntity';
import { enemyPool, getEnemyCoinReward } from './entities/EnemyPool';
import { addCoins } from '../domain/playerProgress';
import { getSettings } from '../domain/settings';
import { defeatBoss } from '../domain/defeatedBosses';
import { chunkKeyAt, type ChunkKey } from '../domain/chunks';
import { ParticleSystem } from './effects/ParticleSystem';
import { ScreenShake } from './effects/ScreenShake';
import type { ProjectileSystem } from './ProjectileSystem';
import type { FireSystem } from './FireSystem';

const HIT_SHAKE_INTENSITY = 0.1;
const HIT_SHAKE_DURATION = 0.15;

export class CombatSystem {
    private enemies: { entity: Entity; source: EnemyEntity }[] = [];
    /** Killed enemies fading out: out of the fight already, back to the pool once gone. */
    private dying: { entity: Entity; source: EnemyEntity }[] = [];

    private sources: EnemyEntity[] = [];
    private hitParticles: ParticleSystem;
    private screenShake = new ScreenShake();
    private entityGroup: THREE.Group;
    private player: Entity;
    private projectiles: ProjectileSystem;
    private fire: FireSystem;
    private onKill: (entity: Entity) => void;
    private onSpawn: (entity: Entity) => void;

    private scratchBoxA = new THREE.Box3();
    private scratchBoxB = new THREE.Box3();
    private scratchCenter = new THREE.Vector3();

    constructor(
        entityGroup: THREE.Group,
        player: Entity,
        projectiles: ProjectileSystem,
        fire: FireSystem,
        onKill: (entity: Entity) => void,
        onSpawn: (entity: Entity) => void,
    ) {
        this.entityGroup = entityGroup;
        this.player = player;
        this.projectiles = projectiles;
        this.fire = fire;
        this.onKill = onKill;
        this.onSpawn = onSpawn;
        this.hitParticles = new ParticleSystem(entityGroup);
    }

    public clear() {
        this.finishDying();
        this.enemies = [];
        this.sources = [];
        this.projectiles.clear();
        this.fire.clear();
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
        // Arrows and flames in the air or planted around belong to the fight being reset.
        this.projectiles.clear();
        this.fire.clear();
        // Under the black screen: a body still fading would stand beside its revived self.
        this.finishDying();
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
        this.resolveArrows(dt);
        this.resolveFire(dt);
        this.updateDying(dt);
        this.hitParticles.update(dt);
        // Advanced even when switched off, so switching it back on cannot replay a stale shake.
        const shake = this.screenShake.getOffset(dt);
        if (getSettings().screenShake) camera.position.add(shake);
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

            this.hurtPlayer(attack.damage, playerBox.getCenter(this.scratchCenter));
        }
    }

    /** Arrows fly on even with every archer dead or unloaded, so they are resolved on their own. */
    private resolveArrows(dt: number) {
        const playerBox = hurtbox(this.player, this.scratchBoxA);
        this.projectiles.update(dt, playerBox, (damage, point) => this.hurtPlayer(damage, point));
    }

    /** Like arrows: a breath already poured keeps burning after its dragon is gone. */
    private resolveFire(dt: number) {
        const playerBox = hurtbox(this.player, this.scratchBoxA);
        this.fire.update(dt, playerBox, (damage, point) => this.hurtPlayer(damage, point));
    }

    private hurtPlayer(damage: number, at: THREE.Vector3) {
        const health = this.player.getComponent('health');
        health?.takeDamage(damage);
        // Same as an enemy: the fatal hit leaves the burst and the flash to the death fade.
        if (!health?.isDead()) {
            this.player.getComponent('hitFlash')?.trigger();
            this.hitParticles.spawnBurst(at);
        }
        this.screenShake.trigger(HIT_SHAKE_INTENSITY, HIT_SHAKE_DURATION);
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

            this.screenShake.trigger(HIT_SHAKE_INTENSITY, HIT_SHAKE_DURATION);

            // The killing blow has no burst: the body turning white is the hit.
            if (health?.isDead()) {
                this.killEnemy(entity, source);
            } else {
                entity.getComponent('hitFlash')?.trigger();
                this.hitParticles.spawnBurst(enemyBox.getCenter(this.scratchCenter));
            }
        }
    }

    /**
     * Out of the fight at once (no more hits either way) and paid for, but the
     * body stays where it fell, frozen mid-pose, while it whitens and fades.
     */
    private killEnemy(entity: Entity, source: EnemyEntity) {
        this.enemies = this.enemies.filter((e) => e.entity !== entity);
        if (source.enemyType === 'boss') defeatBoss(source.id);
        addCoins(getEnemyCoinReward(source.enemyType));
        this.onKill(entity);

        // Before the fade reads the materials, so it starts from their real colours.
        entity.getComponent('hitFlash')?.reset();
        entity.getComponent('healthBar')?.hide();
        entity.getComponent('dashTrail')?.reset();
        entity.getComponent('deathFade')?.start();
        this.dying.push({ entity, source });
    }

    private updateDying(dt: number) {
        if (this.dying.length === 0) return;

        for (const { entity } of this.dying) entity.getComponent('deathFade')?.update(dt);
        this.dying = this.dying.filter(({ entity, source }) => {
            if (entity.getComponent('deathFade')?.done === false) return true;
            this.removeBody(entity, source);
            return false;
        });
    }

    private finishDying() {
        for (const { entity, source } of this.dying) this.removeBody(entity, source);
        this.dying = [];
    }

    private removeBody(entity: Entity, source: EnemyEntity) {
        this.entityGroup.remove(entity.mesh);
        enemyPool.release(entity, source.enemyType);
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
