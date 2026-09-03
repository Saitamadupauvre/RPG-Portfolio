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
import { createToonMaterial } from '../render/toon';

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
const materialTemplate = new Map<EnemyEntity['enemyType'], THREE.MeshToonMaterial>();

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
        template = createToonMaterial({ color: enemyLook[type].color });
        materialTemplate.set(type, template);
    }
    return template.clone();
}

export class EnemyPool {
    private free = new Map<EnemyEntity['enemyType'], Entity[]>();
    private camera: THREE.Camera | null = null;
    private player: THREE.Object3D | null = null;
    private entityGroup: THREE.Object3D | null = null;

    public init(camera: THREE.Camera, player: THREE.Object3D, entityGroup: THREE.Object3D) {
        this.camera = camera;
        this.player = player;
        this.entityGroup = entityGroup;
    }

    private createEnemy(type: EnemyEntity['enemyType'], id: string, position: THREE.Vector3): Entity {
        const geometry = getGeometry(type);
        const material = createMaterial(type);
        const mesh = new THREE.Mesh(geometry, material);
        const look = enemyLook[type];

        const health = new HealthComponent(look.hp);
        const entity = new Entity(id, mesh, look.size / 2)
            .addComponent('health', health)
            .addComponent('hitFlash', new HitFlashComponent(material));

        if (this.camera) {
            const yOffset = (look.size * 1.6) / 2 + 0.25;
            entity.addComponent('healthBar', new HealthBarComponent(mesh, this.camera, health, yOffset));
        }

        if (this.player && this.entityGroup) {
            const attack = new AttackComponent(mesh, this.entityGroup);
            const combo = new ComboComponent(attack, look.combo);
            const ai = new EnemyAIComponent(mesh, this.player, position, look.moveSpeed, look.aggroRadius, look.deaggroRadius, combo, look.attackRange);
            entity.addComponent('attack', attack).addComponent('enemyAI', ai);
        }

        return entity;
    }

    public acquire(source: EnemyEntity): Entity {
        const position = new THREE.Vector3(...source.position);
        const pool = this.free.get(source.enemyType);
        const entity = pool?.pop() ?? this.createEnemy(source.enemyType, source.id, position);

        entity.id = source.id;

        const health = entity.getComponent('health');
        if (health) health.hp = health.maxHp;
        entity.getComponent('healthBar')?.reset();
        entity.getComponent('enemyAI')?.setOrigin(position);

        applyTransform(entity.mesh, source);
        entity.mesh.visible = true;

        return entity;
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
