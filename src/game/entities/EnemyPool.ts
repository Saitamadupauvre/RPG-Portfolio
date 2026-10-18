import * as THREE from 'three';
import type { EnemyEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { HealthComponent } from '../../domain/components/HealthComponent';
import { HitFlashComponent } from './components/HitFlashComponent';
import { HealthBarComponent } from './components/HealthBarComponent';
import { AttackComponent } from './components/AttackComponent';
import { ComboComponent, type ComboMove } from './components/ComboComponent';
import { EnemyAIComponent } from './components/EnemyAIComponent';
import { ComboAttacker, type EnemyAttacker } from './components/EnemyAttacker';
import { LungeComponent, type LungeOptions } from './components/LungeComponent';
import { DashTrailComponent } from './components/DashTrailComponent';
import type { TrailRendererOptions } from '../effects/TrailRenderer';
import { createLitMaterial } from '../render/materials';
import { PALETTE } from '../render/palette';
import { loadModel } from './loadModel';

/** Stand and swing within `range`, or prepare and dash at the player. */
type EnemyAttack =
    | { kind: 'combo'; range: number; moves: ComboMove[] }
    | { kind: 'lunge'; options: LungeOptions };

interface EnemyLook {
    size: number;
    color: number;
    hp: number;
    moveSpeed: number;
    aggroRadius: number;
    /** Measured from the spawn point, not the enemy: how far the player must run from its home. */
    deaggroRadius: number;
    coins: number;
    attack: EnemyAttack;
    /** Blender model (tools/blender/make_enemies.py) that replaces the placeholder box; none yet for the boss. */
    model?: { url: string; height: number };
}

const enemyLook: Record<EnemyEntity['enemyType'], EnemyLook> = {
    grunt: {
        size: 0.6, color: PALETTE.berry, hp: 20, model: { url: 'models/enemy-goblin.glb', height: 1.05 },
        moveSpeed: 2, aggroRadius: 10, deaggroRadius: 28, coins: 5,
        attack: {
            kind: 'lunge',
            options: {
                range: 4, prepare: 0.55, speed: 12, distance: 4.5, recovery: 0.6, cooldown: 1.5,
                hit: { damage: 10, distance: 0.5, size: new THREE.Vector3(0.8, 0.8, 0.8), color: 0xffaa00 },
            },
        },
    },
    elite: {
        size: 0.9, color: PALETTE.autumn, hp: 50, model: { url: 'models/enemy-soldier.glb', height: 2 },
        moveSpeed: 2.5, aggroRadius: 12, deaggroRadius: 30, coins: 18,
        attack: { kind: 'combo', range: 1.3, moves: [
            { options: { damage: 6, distance: 1, duration: 0.2, color: 0xffaa00 }, recovery: 0.25, windup: 0.3 },
            { options: { damage: 14, distance: 1.2, duration: 0.35, color: 0xff3300 }, recovery: 0.7, windup: 0.5 },
        ] },
    },
    boss: {
        size: 1.4, color: PALETTE.bark, hp: 200,
        moveSpeed: 2.2, aggroRadius: 14, deaggroRadius: 30, coins: 80,
        attack: { kind: 'combo', range: 1.6, moves: [
            { options: { damage: 10, distance: 1.4, duration: 0.25, color: 0xffaa00 }, recovery: 0.3, windup: 0.4 },
            { options: { damage: 10, distance: 1.4, duration: 0.25, color: 0xffaa00 }, recovery: 0.3, windup: 0.4 },
            { options: { damage: 25, distance: 1.8, duration: 0.4, color: 0xff0000 }, recovery: 1, windup: 0.8 },
        ] },
    },
};

const ENEMY_TRAIL: TrailRendererOptions = {
    time: 0.25,
    width: 0.8,
    gradient: [
        { t: 0, color: PALETTE.cream, alpha: 0.9 },
        { t: 0.25, color: PALETTE.berry, alpha: 0.85 },
        { t: 1, color: PALETTE.berry, alpha: 0 },
    ],
};

/** Coins dropped on kill, authored per enemy type next to its other stats. */
export function getEnemyCoinReward(type: EnemyEntity['enemyType']): number {
    return enemyLook[type].coins;
}

const sharedGeometry = new Map<EnemyEntity['enemyType'], THREE.BufferGeometry>();
const materialTemplate = new Map<EnemyEntity['enemyType'], THREE.MeshLambertMaterial>();

function getGeometry(type: EnemyEntity['enemyType']) {
    let geometry = sharedGeometry.get(type);
    if (!geometry) {
        const { size } = enemyLook[type];
        geometry = new THREE.BoxGeometry(size, size * 1.6, size);
        sharedGeometry.set(type, geometry);
    }
    return geometry;
}

function createMaterial(type: EnemyEntity['enemyType']) {
    let template = materialTemplate.get(type);
    if (!template) {
        template = createLitMaterial({ color: enemyLook[type].color });
        materialTemplate.set(type, template);
    }
    return template.clone();
}

/** What every enemy needs from the scene. Only exists once the World is built. */
type EnemyPoolDeps = {
    camera: THREE.Camera;
    player: THREE.Object3D;
    entityGroup: THREE.Object3D;
};

/** The box is centred on its origin, so its feet sit half its height below it. */
function bodyHeightOf(type: EnemyEntity['enemyType']): number {
    return enemyLook[type].size * 1.6;
}

export class EnemyPool {
    private free = new Map<EnemyEntity['enemyType'], Entity[]>();
    private deps: EnemyPoolDeps | null = null;

    public init(camera: THREE.Camera, player: THREE.Object3D, entityGroup: THREE.Object3D) {
        this.deps = { camera, player, entityGroup };
    }

    private createEnemy(type: EnemyEntity['enemyType'], id: string): Entity {
        // Fail loudly: before this check, a missing init() quietly built enemies
        // with no AI and no health bar, which looks like a gameplay bug.
        if (!this.deps) throw new Error('enemyPool.init(camera, player, entityGroup) must run before the first enemy spawns');
        const { camera, player, entityGroup } = this.deps;

        const geometry = getGeometry(type);
        const material = createMaterial(type);
        const look = enemyLook[type];
        const height = bodyHeightOf(type);

        // The root is what moves, turns and gets hit; the box inside is only the stand-in
        // until the model arrives (and stays for types that have none).
        const mesh = new THREE.Group();
        const placeholder = new THREE.Mesh(geometry, material);
        mesh.add(placeholder);

        const health = new HealthComponent(look.hp);
        const attack = new AttackComponent(mesh);
        const attacker: EnemyAttacker = look.attack.kind === 'lunge'
            ? new LungeComponent(mesh, player, attack, look.attack.options)
            : new ComboAttacker(new ComboComponent(attack, look.attack.moves), look.attack.range);
        // Origin is a placeholder; acquire() resets the AI onto the real one.
        const ai = new EnemyAIComponent(mesh, player, mesh.position, look.moveSpeed, look.aggroRadius, look.deaggroRadius, attacker);

        const entity = new Entity(id, mesh, look.size / 2)
            .addComponent('health', health)
            .addComponent('hitFlash', new HitFlashComponent(material))
            .addComponent('healthBar', new HealthBarComponent(mesh, camera, health, height / 2 + 0.25))
            // AI before attack: a lunge moves the body first, then the hitbox catches up the same frame.
            .addComponent('enemyAI', ai)
            .addComponent('attack', attack);
        // Only lungers dash; the trail runs after the AI so its head is where the body ended up.
        if (attacker instanceof LungeComponent) {
            entity.addComponent('dashTrail', new DashTrailComponent(mesh, entityGroup, () => attacker.isDashing, ENEMY_TRAIL));
        }
        entity.bodyHeight = height;
        entity.groundOffset = height / 2;

        if (look.model) {
            const hitFlash = entity.getComponent('hitFlash');
            // The root's origin is the body's centre, so the model's feet go half a body below it.
            loadModel(look.model.url, { height: look.model.height, originY: -height / 2 })
                .then(({ object, materials }) => {
                    mesh.remove(placeholder);
                    material.dispose();
                    mesh.add(object);
                    hitFlash?.setMaterials(materials);
                })
                .catch((error) => console.error(`[enemy] ${look.model?.url} failed to load, keeping placeholder`, error));
        }

        return entity;
    }

    public acquire(source: EnemyEntity): Entity {
        const pool = this.free.get(source.enemyType);
        const entity = pool?.pop() ?? this.createEnemy(source.enemyType, source.id);

        entity.id = source.id;
        entity.setDisposer(() => this.release(entity, source.enemyType));
        this.reset(entity, source);
        entity.mesh.visible = true;

        return entity;
    }

    /**
     * Back to just-spawned: full health, at its authored spot, no swing,
     * flash or aggro carried over from a previous life. Shared by a fresh
     * acquire and by a bonfire rest resetting a live enemy.
     */
    public reset(entity: Entity, source: EnemyEntity) {
        const health = entity.getComponent('health');
        if (health) health.hp = health.maxHp;
        entity.getComponent('healthBar')?.reset();
        entity.getComponent('hitFlash')?.reset();
        entity.getComponent('attack')?.reset();
        entity.getComponent('dashTrail')?.reset();

        applyTransform(entity.mesh, source, entity.groundOffset);
        // Origin is read after the transform so the AI returns to the point on
        // the terrain the enemy actually stands on, not the layout's flat Y.
        entity.getComponent('enemyAI')?.reset(entity.mesh.position);
    }

    public release(entity: Entity, type: EnemyEntity['enemyType']) {
        entity.mesh.visible = false;
        // The trail lives in the world, not under the enemy, so hiding the body leaves it behind.
        entity.getComponent('dashTrail')?.reset();
        let pool = this.free.get(type);
        if (!pool) {
            pool = [];
            this.free.set(type, pool);
        }
        pool.push(entity);
    }
}

export const enemyPool = new EnemyPool();
