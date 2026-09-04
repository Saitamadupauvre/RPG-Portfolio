import * as THREE from 'three';
import { Entity } from './Entity';
import { MovementComponent } from './components/MovementComponent';
import { DashComponent } from './components/DashComponent';
import { AttackComponent } from './components/AttackComponent';
import { ComboComponent, type ComboMove } from './components/ComboComponent';
import { AnimationComponent, HAND_REST } from './components/AnimationComponent';
import { DustEmitterComponent } from './components/DustEmitterComponent';
import { SwordTrailComponent } from './components/SwordTrailComponent';
import { HitFlashComponent } from './components/HitFlashComponent';
import { HealthComponent } from '../../domain/components/HealthComponent';
import { createSwordMesh } from './SwordFactory';
import { loadModel } from './loadModel';
import { events } from '../../core/events';
import { createToonMaterial } from '../render/toon';

const PLAYER_SPEED = 4;
const PLAYER_HP = 100;
const PLAYER_RADIUS = 0.4;

const PLAYER_MODEL_URL = 'player/player.glb';
const PLAYER_HEIGHT = 1.8;
/** Root sits at y = 0.9, so the model's feet must be half a body below its own origin. */
const PLAYER_MODEL_ORIGIN_Y = -PLAYER_HEIGHT / 2;

const COMBO_MOVES: ComboMove[] = [
    { options: { damage: 12, distance: 0.9, duration: 0.18, color: 0x66ccff }, recovery: 0.18, windup: 0.12 },
    { options: { damage: 16, distance: 1.1, duration: 0.22, color: 0x3399ff }, recovery: 0.35, windup: 0.14 },
];

export function createPlayer(cameraOffset: THREE.Vector3, entityGroup: THREE.Group): Entity {
    // root: tracked by movement/collision/camera, stays free of animation jitter.
    const root = new THREE.Group();
    root.position.set(0, 0.9, 0);

    // visual: the animated child — every procedural pose is applied here only, never to root.
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

    // Hand and sword are separate objects on purpose: swapping weapons later is
    // just replacing the sword child under the hand.
    const handGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const handMaterial = createToonMaterial({ color: 0xf0c894 });
    const hand = new THREE.Mesh(handGeometry, handMaterial);
    hand.position.copy(HAND_REST);
    visual.add(hand);

    const sword = createSwordMesh();
    hand.add(sword);

    const movement = new MovementComponent(root, cameraOffset, PLAYER_SPEED);
    const attack = new AttackComponent(root, entityGroup, {}, {
        onAttackStart: () => movement.setLocked(true),
        onAttackEnd: () => movement.setLocked(false),
    });
    const combo = new ComboComponent(attack, COMBO_MOVES);
    const dash = new DashComponent(root, movement);
    const hitFlash = new HitFlashComponent(material);

    const health = new HealthComponent(PLAYER_HP, (hp, maxHp) => {
        events.emit('playerHealthChanged', hp, maxHp);
    });

    health.publish();

    loadModel(PLAYER_MODEL_URL, { height: PLAYER_HEIGHT, originY: PLAYER_MODEL_ORIGIN_Y })
        .then(({ object, materials }) => {
            visual.remove(body);
            geometry.dispose();
            material.dispose();

            // Insert below the hand so the sword arm keeps rendering on top of the body.
            visual.add(object);
            hitFlash.setMaterials(materials);
        })
        .catch((error) => console.error('[player] model failed to load, keeping placeholder', error));

    const entity = new Entity('player', root, PLAYER_RADIUS);
    // The capsule's origin is its centre, so the root rides half a body above
    // the ground it stands on.
    entity.groundOffset = PLAYER_HEIGHT / 2;

    return entity
        .addComponent('movement', movement)
        .addComponent('dash', dash)
        .addComponent('attack', attack)
        .addComponent('combo', combo)
        .addComponent('animation', new AnimationComponent(visual, movement, { hand, dash, attack, combo }))
        .addComponent('dust', new DustEmitterComponent(root, movement, entityGroup))
        .addComponent('swordTrail', new SwordTrailComponent(hand, attack, entityGroup))
        .addComponent('health', health)
        .addComponent('hitFlash', hitFlash);
}
