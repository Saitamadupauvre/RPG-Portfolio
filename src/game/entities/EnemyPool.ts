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
import { ComboAttacker, type EnemyAttacker, type RoamingAttacker } from './components/EnemyAttacker';
import type { EnemyBrain } from './components/EnemyBrain';
import { RoamAIComponent, type RoamOptions } from './components/RoamAIComponent';
import { LungeComponent, type LungeOptions } from './components/LungeComponent';
import { ShootComponent, type ShootOptions } from './components/ShootComponent';
import { ArcherAnimationDriver } from './components/ArcherAnimationDriver';
import { BreathComponent, type BreathOptions } from './components/BreathComponent';
import { BreathAnimationDriver } from './components/BreathAnimationDriver';
import { ComboAnimationDriver } from './components/ComboAnimationDriver';
import { LungeAnimationDriver } from './components/LungeAnimationDriver';
import type { AnimationDriver } from './components/AnimationDriver';
import { DashTrailComponent } from './components/DashTrailComponent';
import { XrayComponent } from './components/XrayComponent';
import { XraySilhouette } from '../render/xraySilhouette';
import type { TrailRendererOptions } from '../effects/TrailRenderer';
import type { ProjectileSystem } from '../ProjectileSystem';
import type { FireSystem } from '../FireSystem';
import { AnimatorComponent } from '../animation/AnimatorComponent';
import { collectRig } from '../animation/Rig';
import type { AnimatorControllerDefinition } from '../../domain/animation/AnimatorController';
import { archerController } from './archerAnimation';
import { dragonController } from './dragonAnimation';
import { goblinController } from './goblinAnimation';
import { soldierController } from './soldierAnimation';
import { createLitMaterial } from '../render/materials';
import { PALETTE } from '../render/palette';
import { loadModel, type ModelFitOptions } from './loadModel';

/** Stand and swing within `range`, prepare and dash at the player, keep away and shoot, or breathe fire. */
type EnemyAttack =
    | { kind: 'combo'; range: number; moves: ComboMove[] }
    | { kind: 'lunge'; options: LungeOptions }
    | { kind: 'shoot'; options: ShootOptions }
    | { kind: 'breath'; options: BreathOptions };

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
    /** Roams a patch of the map around its spawn instead of hunting the player down (RoamAIComponent). */
    roam?: RoamOptions;
    /** Blender model (tools/blender/make_enemies.py) that replaces the placeholder box; none yet for the boss. */
    model?: {
        url: string;
        height: number;
        anchor?: ModelFitOptions['anchor'];
        /** The graph that plays the model's clips: they come with the model, so does what plays them. */
        controller: AnimatorControllerDefinition;
        /** The node in the rig a ranged attack leaves from (the archer's nocked arrow, the dragon's snout). */
        muzzle?: string;
    };
}

const enemyLook: Record<EnemyEntity['enemyType'], EnemyLook> = {
    grunt: {
        size: 0.6, color: PALETTE.berry, hp: 20, model: { url: 'models/enemy-goblin.glb', height: 1.05, controller: goblinController },
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
        size: 0.9, color: PALETTE.autumn, hp: 50, model: { url: 'models/enemy-soldier.glb', height: 2, controller: soldierController },
        moveSpeed: 2.5, aggroRadius: 12, deaggroRadius: 30, coins: 18,
        attack: { kind: 'combo', range: 1.3, moves: [
            { options: { damage: 6, distance: 1, duration: 0.2, color: 0xffaa00 }, recovery: 0.25, windup: 0.3 },
            { options: { damage: 14, distance: 1.2, duration: 0.35, color: 0xff3300 }, recovery: 0.7, windup: 0.5 },
        ] },
    },
    archer: {
        // Hollow bones: frail, two sword hits. The box is a little wider than the bones so hits feel fair.
        size: 1, color: PALETTE.wheat, hp: 22,
        // Anchored on its own origin, between its feet: the bow on one side would pull a bounding-box centre off its axis.
        model: { url: 'models/enemy-skeleton.glb', height: 1.62, anchor: 'origin', controller: archerController, muzzle: 'Arrow' },
        moveSpeed: 2, aggroRadius: 13, deaggroRadius: 30, coins: 10,
        attack: {
            kind: 'shoot',
            options: {
                range: 10, draw: 1, lock: 0.18, recovery: 0.6, cooldown: 1.4, flinch: 0.45,
                arrow: { speed: 15, damage: 8, lead: 0.6 },
                retreat: 3.5, hop: { distance: 2.5, duration: 0.5, cooldown: 3 },
            },
        },
    },
    dragon: {
        // A small critter, faster than the player: it never chases, it darts about and now and then breathes
        // fire. Frail once caught, and a blow breaks off its breath and sends it running.
        size: 0.7, color: PALETTE.ember, hp: 30,
        // Anchored on its origin, between its legs: the bushy tail would pull a bounding-box centre backward.
        // Fit to 1, the height its run cycle's planted paws were measured at (dragonAnimation.ts).
        model: { url: 'models/enemy-dragon.glb', height: 1, anchor: 'origin', controller: dragonController, muzzle: 'Mouth' },
        moveSpeed: 5.5, aggroRadius: 7, deaggroRadius: 14, coins: 12,
        roam: { zone: 6, pause: { calm: [0.6, 1.6], alert: [0.15, 0.4] }, orbit: [2.6, 4], startle: 1.8, attackChance: 0.35 },
        attack: {
            kind: 'breath',
            options: {
                range: 4, windup: 0.45, breathe: 0.8, recovery: 0.4, cooldown: 4,
                turnRate: 1.8, rate: 30, spread: 0.14,
                flame: { speed: 9, life: 0.6, damage: 4, size: 0.55 },
            },
        },
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
    /** Where archers put their arrows. */
    projectiles: ProjectileSystem;
    /** Where dragons put their flames. */
    fire: FireSystem;
};

/**
 * An attacker and how to animate it. The driver reads the attacker's phases, so the two are
 * built side by side here rather than matched up later with `instanceof`.
 */
type Fighter = {
    attacker: EnemyAttacker;
    /** The same attacker, when a roaming brain can drive it: only attacks it can break off. */
    roamer?: RoamingAttacker;
    /** Builds the driver playing this attacker on an animator, for an enemy whose model has clips. */
    drive: (animator: AnimatorComponent) => AnimationDriver;
    /** Hands a ranged attacker the model's `muzzle` node once it has loaded. */
    setMuzzle?: (node: THREE.Object3D | null) => void;
};

function createFighter(look: EnemyLook, mesh: THREE.Object3D, attack: AttackComponent, health: HealthComponent, deps: EnemyPoolDeps): Fighter {
    switch (look.attack.kind) {
        case 'lunge': {
            const lunge = new LungeComponent(mesh, deps.player, attack, look.attack.options);
            return { attacker: lunge, drive: (animator) => new LungeAnimationDriver(animator, mesh, lunge) };
        }
        case 'combo': {
            const combo = new ComboComponent(attack, look.attack.moves);
            return {
                attacker: new ComboAttacker(combo, look.attack.range),
                drive: (animator) => new ComboAnimationDriver(animator, mesh, combo, attack),
            };
        }
        case 'shoot': {
            const shoot = new ShootComponent(mesh, deps.player, attack, health, deps.projectiles, look.attack.options);
            return {
                attacker: shoot,
                drive: (animator) => new ArcherAnimationDriver(animator, mesh, shoot),
                setMuzzle: (node) => shoot.setMuzzle(node),
            };
        }
        case 'breath': {
            const breath = new BreathComponent(mesh, deps.player, attack, deps.fire, look.attack.options);
            return {
                attacker: breath,
                roamer: breath,
                drive: (animator) => new BreathAnimationDriver(animator, mesh, breath),
                setMuzzle: (node) => breath.setMuzzle(node),
            };
        }
    }
}

/** A roaming critter's brain when the look has `roam`, a hunter's otherwise. */
function createBrain(look: EnemyLook, mesh: THREE.Object3D, health: HealthComponent, fighter: Fighter, player: THREE.Object3D): EnemyBrain {
    // Origin is a placeholder; acquire() resets the AI onto the real one.
    const { moveSpeed, aggroRadius, deaggroRadius, roam } = look;
    if (!roam) return new EnemyAIComponent(mesh, player, mesh.position, moveSpeed, aggroRadius, deaggroRadius, fighter.attacker);
    if (!fighter.roamer) throw new Error(`a roaming enemy needs an attack it can break off, not '${look.attack.kind}'`);
    return new RoamAIComponent(mesh, player, health, mesh.position, moveSpeed, aggroRadius, deaggroRadius, fighter.roamer, roam);
}

/** The box is centred on its origin, so its feet sit half its height below it. */
function bodyHeightOf(type: EnemyEntity['enemyType']): number {
    return enemyLook[type].size * 1.6;
}

export class EnemyPool {
    private free = new Map<EnemyEntity['enemyType'], Entity[]>();
    private deps: EnemyPoolDeps | null = null;

    public init(camera: THREE.Camera, player: THREE.Object3D, entityGroup: THREE.Object3D, projectiles: ProjectileSystem, fire: FireSystem) {
        this.deps = { camera, player, entityGroup, projectiles, fire };
    }

    private createEnemy(type: EnemyEntity['enemyType'], id: string): Entity {
        // Fail loudly: before this check, a missing init() quietly built enemies
        // with no AI and no health bar, which looks like a gameplay bug.
        if (!this.deps) throw new Error('enemyPool.init(camera, player, entityGroup, projectiles, fire) must run before the first enemy spawns');
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
        const fighter = createFighter(look, mesh, attack, health, this.deps);
        const { attacker, drive, setMuzzle } = fighter;
        const ai = createBrain(look, mesh, health, fighter, player);

        const entity = new Entity(id, mesh, look.size / 2)
            .addComponent('health', health)
            .addComponent('hitFlash', new HitFlashComponent(material))
            .addComponent('healthBar', new HealthBarComponent(mesh, camera, health, height / 2 + 0.25))
            // AI before attack: a lunge moves the body first, then the hitbox catches up the same frame.
            .addComponent('enemyAI', ai)
            .addComponent('attack', attack);
        // Red through walls only while hunting the player close by, so a hidden threat is never a surprise.
        // Aggro only drops far from home, so a chase the player outran would otherwise stay lit across the map.
        const xray = new XraySilhouette(mesh, PALETTE.berry, false);
        const isHunting = () => ai.isAggroed && mesh.position.distanceTo(player.position) <= look.aggroRadius;
        entity.addComponent('xray', new XrayComponent(xray, isHunting));
        // Only lungers dash; the trail runs after the AI so its head is where the body ended up.
        if (attacker instanceof LungeComponent) {
            entity.addComponent('dashTrail', new DashTrailComponent(mesh, entityGroup, () => attacker.isDashing, ENEMY_TRAIL));
        }
        // Every modelled enemy has clips; the boss has no model yet, so no animator either.
        // After the AI, so the driver reads this frame's move, swing or shot.
        let animator: AnimatorComponent | null = null;
        if (look.model) {
            animator = new AnimatorComponent(look.model.controller);
            entity
                .addComponent('animationDriver', drive(animator))
                .addComponent('animator', animator);
        }
        entity.bodyHeight = height;
        entity.groundOffset = height / 2;

        if (look.model) {
            const hitFlash = entity.getComponent('hitFlash');
            const { url, anchor, muzzle } = look.model;
            // The root's origin is the body's centre, so the model's feet go half a body below it.
            loadModel(url, { height: look.model.height, originY: -height / 2, anchor })
                .then(({ object, materials, animations }) => {
                    mesh.remove(placeholder);
                    material.dispose();
                    mesh.add(object);
                    hitFlash?.setMaterials(materials);
                    entity.getComponent('xray')?.refresh();
                    if (muzzle) setMuzzle?.(object.getObjectByName(muzzle) ?? null);
                    if (!animator) return;
                    try {
                        animator.bind(collectRig(object), animations);
                    } catch (error) {
                        console.error(`[enemy] ${url}: animation setup failed, the model will stand still`, error);
                    }
                })
                .catch((error) => console.error(`[enemy] ${url} failed to load, keeping placeholder`, error));
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
        entity.getComponent('animationDriver')?.reset();

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
