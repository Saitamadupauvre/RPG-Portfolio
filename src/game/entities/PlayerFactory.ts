import * as THREE from 'three';
import { Entity } from './Entity';
import { MovementComponent } from './components/MovementComponent';
import { DashComponent } from './components/DashComponent';
import { AttackComponent } from './components/AttackComponent';
import { ComboComponent, type ComboMove } from './components/ComboComponent';
import { PlayerAnimationDriver } from './components/PlayerAnimationDriver';
import { DustEmitterComponent } from './components/DustEmitterComponent';
import { SwordTrailComponent } from './components/SwordTrailComponent';
import { HitFlashComponent } from './components/HitFlashComponent';
import { HealthComponent } from '../../domain/components/HealthComponent';
import { AnimatorComponent } from '../animation/AnimatorComponent';
import { collectRig, equip } from '../animation/Rig';
import { playerController } from './playerAnimation';
import { createSwordMesh } from './SwordFactory';
import { loadModel } from './loadModel';
import { events } from '../../core/events';
import { createToonMaterial } from '../render/toon';
import { getPlayerStats } from '../../domain/playerProgress';

const PLAYER_RADIUS = 0.4;

const PLAYER_MODEL_URL = 'player/player.glb';
const PLAYER_HEIGHT = 1.8;
/** Root sits at y = 0.9, so the model's feet must be half a body below its own origin. */
const PLAYER_MODEL_ORIGIN_Y = -PLAYER_HEIGHT / 2;

/** The Empty in the Blender file that marks where the sword's grip goes. */
const WEAPON_SOCKET = 'Socket_HandR';

const COMBO_MOVES: ComboMove[] = [
    // Scaled off the Strength stat (base 10): 12 and 16 damage before any upgrade.
    { options: { distance: 0.9, duration: 0.18, color: 0x66ccff }, damageScale: 1.2, recovery: 0.18, windup: 0.12 },
    { options: { distance: 1.1, duration: 0.22, color: 0x3399ff }, damageScale: 1.6, recovery: 0.35, windup: 0.14 },
];

export function createPlayer(cameraOffset: THREE.Vector3, entityGroup: THREE.Group): Entity {
    // root: tracked by movement/collision/camera, stays free of animation jitter.
    const root = new THREE.Group();
    root.position.set(0, 0.9, 0);

    // visual: the model hangs here. Clips move the bones below it; the driver leans it into turns.
    const visual = new THREE.Group();
    root.add(visual);

    // Placeholder capsule so the player exists and is controllable on frame one; the glTF
    // swaps in whenever it finishes loading. Keeping the factory synchronous means World,
    // the camera and every system can hold the Entity immediately.
    const geometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const material = createToonMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(geometry, material);
    body.castShadow = true;
    visual.add(body);

    // The sword starts in a stand-in socket at hand height and moves into the model's own
    // socket once it loads, so a model without one (the current bean) still carries it.
    const sword = createSwordMesh();
    const standInSocket = new THREE.Object3D();
    standInSocket.position.set(-0.45, -0.55, 0.2);
    standInSocket.rotation.x = 0.45;
    standInSocket.add(sword);
    visual.add(standInSocket);

    // Base values come from the progression rules, so there is one source of
    // truth for "how fast / how tough is the player" — bindPlayerStats keeps
    // them in sync after every upgrade.
    const stats = getPlayerStats();

    const movement = new MovementComponent(root, cameraOffset, stats.speed);
    const attack = new AttackComponent(root);
    // Attack clips are full-body, so the body plants for the whole move: no turning, no sliding.
    const combo = new ComboComponent(attack, COMBO_MOVES, {
        onBusyChanged: (busy) => {
            movement.setLocked(busy);
            if (busy) movement.freeze('attack');
            else movement.unfreeze('attack');
        },
    });
    const dash = new DashComponent(root, movement);
    const hitFlash = new HitFlashComponent(material);
    // The graph runs from frame one; it gets its bones and clips when the model arrives.
    const animator = new AnimatorComponent(playerController);

    const health = new HealthComponent(stats.health, (hp, maxHp) => {
        events.emit('playerHealthChanged', hp, maxHp);
    });

    health.publish();

    loadModel(PLAYER_MODEL_URL, { height: PLAYER_HEIGHT, originY: PLAYER_MODEL_ORIGIN_Y })
        .then(({ object, materials, animations }) => {
            visual.remove(body);
            geometry.dispose();
            material.dispose();

            visual.add(object);
            hitFlash.setMaterials(materials);

            if (!equip(object, WEAPON_SOCKET, sword)) {
                console.warn(`[player] model has no "${WEAPON_SOCKET}" empty; the sword stays at the stand-in position`);
            }

            if (animations.length === 0) {
                console.warn('[player] model has no animations; export the Actions from Blender to bring it to life');
                return;
            }
            try {
                animator.bind(collectRig(object), animations);
            } catch (error) {
                console.error('[player] animation setup failed, the model will stand still', error);
            }
        })
        .catch((error) => console.error('[player] model failed to load, keeping placeholder', error));

    const entity = new Entity('player', root, PLAYER_RADIUS);
    // The capsule's origin is its centre, so the root rides half a body above
    // the ground it stands on.
    entity.groundOffset = PLAYER_HEIGHT / 2;
    entity.bodyHeight = PLAYER_HEIGHT;

    // Components update in insertion order: the driver must set its parameters before the
    // animator reads them, and the animator must pose the sword before the trail samples it.
    return entity
        .addComponent('movement', movement)
        .addComponent('dash', dash)
        .addComponent('attack', attack)
        .addComponent('combo', combo)
        .addComponent('animationDriver', new PlayerAnimationDriver(animator, visual, movement, { dash, attack, combo }))
        .addComponent('animator', animator)
        .addComponent('dust', new DustEmitterComponent(root, movement, entityGroup))
        .addComponent('swordTrail', new SwordTrailComponent(sword, attack, entityGroup))
        .addComponent('health', health)
        .addComponent('hitFlash', hitFlash);
}
