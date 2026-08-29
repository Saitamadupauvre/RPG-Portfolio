import * as THREE from 'three';
import { Entity } from './Entity';
import { MovementComponent } from './components/MovementComponent';
import { DashComponent } from './components/DashComponent';
import { AttackComponent } from './components/AttackComponent';
import { ComboComponent, type ComboMove } from './components/ComboComponent';
import { AnimationComponent } from './components/AnimationComponent';
import { DustEmitterComponent } from './components/DustEmitterComponent';
import { SwordTrailComponent } from './components/SwordTrailComponent';
import { HitFlashComponent } from './components/HitFlashComponent';
import { HealthComponent } from '../../domain/components/HealthComponent';
import { createSwordMesh } from './SwordFactory';
import { events } from '../../core/events';

const PLAYER_SPEED = 4;
const VISION_CUBE_OFFSET = 0.9;
const PLAYER_HP = 100;
const PLAYER_RADIUS = 0.4;

const HAND_OFFSET = new THREE.Vector3(0.32, 0.05, 0.25);

const COMBO_MOVES: ComboMove[] = [
    { options: { damage: 12, distance: 0.9, duration: 0.18, color: 0x66ccff }, recovery: 0.18, windup: 0.12 },
    { options: { damage: 16, distance: 1.1, duration: 0.22, color: 0x3399ff }, recovery: 0.35, windup: 0.14 },
];

export function createPlayer(cameraOffset: THREE.Vector3, entityGroup: THREE.Group): Entity {
    // root: tracked by movement/collision/camera, stays free of animation jitter.
    const root = new THREE.Group();
    root.position.set(0, 0.9, 0);

    // visual: the animated child — breathing/bob is applied here only, never to root.
    const visual = new THREE.Group();
    root.add(visual);

    const geometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(geometry, material);
    body.castShadow = true;
    visual.add(body);

    const visionGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const visionMaterial = new THREE.MeshStandardMaterial({ color: 0x2255ff });
    const visionCube = new THREE.Mesh(visionGeometry, visionMaterial);
    visionCube.position.set(0, 0, VISION_CUBE_OFFSET);
    body.add(visionCube);

    // Hand and sword are separate objects on purpose: swapping weapons later is
    // just replacing the sword child under the hand.
    const handGeometry = new THREE.SphereGeometry(0.12, 12, 12);
    const handMaterial = new THREE.MeshStandardMaterial({ color: 0xf0c894 });
    const hand = new THREE.Mesh(handGeometry, handMaterial);
    hand.position.copy(HAND_OFFSET);
    visual.add(hand);

    const sword = createSwordMesh();
    hand.add(sword);

    const movement = new MovementComponent(root, cameraOffset, PLAYER_SPEED);
    const attack = new AttackComponent(root, entityGroup, {}, {
        onAttackStart: () => movement.setLocked(true),
        onAttackEnd: () => movement.setLocked(false),
    });
    const combo = new ComboComponent(attack, COMBO_MOVES);

    const health = new HealthComponent(PLAYER_HP, (hp, maxHp) => {
        events.emit('playerHealthChanged', hp, maxHp);
    });

    health.publish();

    return new Entity('player', root, PLAYER_RADIUS)
        .addComponent('movement', movement)
        .addComponent('dash', new DashComponent(root, movement))
        .addComponent('attack', attack)
        .addComponent('combo', combo)
        .addComponent('animation', new AnimationComponent(visual, movement))
        .addComponent('dust', new DustEmitterComponent(root, movement, entityGroup))
        .addComponent('swordTrail', new SwordTrailComponent(hand, attack, entityGroup))
        .addComponent('health', health)
        .addComponent('hitFlash', new HitFlashComponent(material));
}
