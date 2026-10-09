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
import { createLitMaterial } from '../render/materials';

interface EnemyLook {
    size: number;
    color: number;
    hp: number;
    moveSpeed: number;
    aggroRadius: number;
    deaggroRadius: number;
    attackRange: number;
    coins: number;
    combo: ComboMove[];
}

const enemyLook: Record<EnemyEntity['enemyType'], EnemyLook> = {
    grunt: {
        size: 0.6, color: 0x33aa33, hp: 20,
        moveSpeed: 2, aggroRadius: 5, deaggroRadius: 8, attackRange: 1.1, coins: 5,
        combo: [
            { options: { damage: 8, distance: 0.9, duration: 0.25, color: 0xffaa00 }, recovery: 0.5, windup: 0.4 },
        ],
    },
    elite: {
        size: 0.9, color: 0xdd8822, hp: 50,
        moveSpeed: 2.5, aggroRadius: 6, deaggroRadius: 10, attackRange: 1.3, coins: 18,
        combo: [
            { options: { damage: 6, distance: 1, duration: 0.2, color: 0xffaa00 }, recovery: 0.25, windup: 0.3 },
            { options: { damage: 14, distance: 1.2, duration: 0.35, color: 0xff3300 }, recovery: 0.7, windup: 0.5 },
        ],
    },
    boss: {
        size: 1.4, color: 0xcc2222, hp: 200,
        moveSpeed: 2.2, aggroRadius: 8, deaggroRadius: 14, attackRange: 1.6, coins: 80,
        combo: [
            { options: { damage: 10, distance: 1.4, duration: 0.25, color: 0xffaa00 }, recovery: 0.3, windup: 0.4 },
            { options: { damage: 10, distance: 1.4, duration: 0.25, color: 0xffaa00 }, recovery: 0.3, windup: 0.4 },
            { options: { damage: 25, distance: 1.8, duration: 0.4, color: 0xff0000 }, recovery: 1, windup: 0.8 },
        ],
    },
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
        const { camera, player } = this.deps;

        const geometry = getGeometry(type);
        const material = createMaterial(type);
        const mesh = new THREE.Mesh(geometry, material);
        const look = enemyLook[type];
        const height = bodyHeightOf(type);

        const health = new HealthComponent(look.hp);
        const attack = new AttackComponent(mesh);
        const combo = new ComboComponent(attack, look.combo);
        // Origin is a placeholder; acquire() resets the AI onto the real one.
        const ai = new EnemyAIComponent(mesh, player, mesh.position, look.moveSpeed, look.aggroRadius, look.deaggroRadius, combo, look.attackRange);

        const entity = new Entity(id, mesh, look.size / 2)
            .addComponent('health', health)
            .addComponent('hitFlash', new HitFlashComponent(material))
            .addComponent('healthBar', new HealthBarComponent(mesh, camera, health, height / 2 + 0.25))
            .addComponent('attack', attack)
            .addComponent('enemyAI', ai);
        entity.bodyHeight = height;
        entity.groundOffset = height / 2;

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

        applyTransform(entity.mesh, source, entity.groundOffset);
        // Origin is read after the transform so the AI returns to the point on
        // the terrain the enemy actually stands on, not the layout's flat Y.
        entity.getComponent('enemyAI')?.reset(entity.mesh.position);
    }

    public release(entity: Entity, type: EnemyEntity['enemyType']) {
        entity.mesh.visible = false;
        let pool = this.free.get(type);
        if (!pool) {
            pool = [];
            this.free.set(type, pool);
        }
        pool.push(entity);
    }
}

export const enemyPool = new EnemyPool();
