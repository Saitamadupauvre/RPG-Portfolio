import * as THREE from 'three';
import { Entity } from './Entity';
import { MovementComponent } from './components/MovementComponent';
import { DashComponent } from './components/DashComponent';
import { AttackComponent } from './components/AttackComponent';
import { ComboComponent, type ComboMove } from './components/ComboComponent';
import { PlayerAnimationDriver } from './components/PlayerAnimationDriver';
import { DustEmitterComponent } from './components/DustEmitterComponent';
import { SwordTrailComponent } from './components/SwordTrailComponent';
import { DashTrailComponent } from './components/DashTrailComponent';
import { LIGHT, PALETTE } from '../render/palette';
import { XraySilhouette } from '../render/xraySilhouette';
import { HitFlashComponent } from './components/HitFlashComponent';
import { DeathFadeComponent } from './components/DeathFadeComponent';
import { HealthComponent } from '../../domain/components/HealthComponent';
import { AnimatorComponent } from '../animation/AnimatorComponent';
import { playerController } from './playerAnimation';
import { createSwordMesh } from './SwordFactory';
import { loadPlayerModel, PLAYER_HEIGHT } from './playerModel';
import { events } from '../../core/events';
import { createLitMaterial } from '../render/materials';
import { getPlayerStats } from '../../domain/playerProgress';
import { playSound } from '../../audio/audio';

const PLAYER_RADIUS = 0.4;
/** How far in front of the root the dash trail starts, so the roll never shows its head. */
const DASH_TRAIL_AHEAD = 0.4;

/** Root sits at y = 0.9, so the model's feet must be half a body below its own origin. */
const PLAYER_MODEL_ORIGIN_Y = -PLAYER_HEIGHT / 2;

const COMBO_MOVES: ComboMove[] = [
    // Scaled off the Strength stat (base 10): 12 and 16 damage before any upgrade.
    // One move for now: the overhead chop that followed it is out until it is redone.
    // Wider than the 0.6 default so a slash catches what stands beside its aim too.
    {
        options: { size: new THREE.Vector3(1.2, 0.9, 1.2), distance: 1, duration: 0.18, color: 0x66ccff },
        damageScale: 1.2,
        recovery: 0.18,
        windup: 0.12,
    },
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
    const material = createLitMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(geometry, material);
    body.castShadow = true;
    visual.add(body);

    // The sword starts in a stand-in socket at hand height and moves into the model's own
    // socket once it loads, so a model without one (the current bean) still carries it.
    const sword = createSwordMesh();
    const standInSocket = new THREE.Object3D();
    standInSocket.position.set(-0.45, -0.55, 0.2);
    // Like the model's rest pose: twisted 35Â° about the blade (Euler XYZ applies Z, the blade
    // axis, first), then raised 60Â° above level (rotating +Z about X tips it up).
    standInSocket.rotation.set(-Math.PI / 3, 0, THREE.MathUtils.degToRad(60));
    standInSocket.add(sword);
    visual.add(standInSocket);

    // Base values come from the progression rules, so there is one source of
    // truth for "how fast / how tough is the player" â€” bindPlayerStats keeps
    // them in sync after every upgrade.
    const stats = getPlayerStats();

    const movement = new MovementComponent(root, cameraOffset, stats.speed, PLAYER_RADIUS);
    // Starts when the hitbox goes live (after the windup), the moment the blade really sweeps.
    const attack = new AttackComponent(root, {}, { onAttackStart: () => playSound('swordSwing') });
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
    animator.on('footstep', () => playSound('footstep'));

    const health = new HealthComponent(stats.health, (hp, maxHp) => {
        events.emit('playerHealthChanged', hp, maxHp);
    });

    health.publish();

    // Grey ghost wherever anything hides the player.
    const xray = new XraySilhouette(root, PALETTE.stone);

    // Takes the sword out of the stand-in socket into the model's hand, and hooks up the animator.
    loadPlayerModel({ originY: PLAYER_MODEL_ORIGIN_Y, sword, animator })
        .then(({ object, materials }) => {
            visual.remove(body);
            geometry.dispose();
            material.dispose();

            visual.add(object);
            hitFlash.setMaterials(materials);
            // The placeholder's twin left with it; the model's meshes get theirs now.
            xray.refresh();
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
        // Right after the dash moves the root, so the trail's head follows the body. The head
        // sits in front of the body (root faces +Z): the dash roll would show it otherwise.
        .addComponent('dashTrail', new DashTrailComponent(root, entityGroup, () => dash.isDashing, {
            time: 0.2,
            width: 0.7,
            gradient: [
                { t: 0, color: PALETTE.cream, alpha: 0.9 },
                { t: 1, color: LIGHT.sky, alpha: 0 },
            ],
        }, new THREE.Vector3(0, 0, DASH_TRAIL_AHEAD)))
        .addComponent('attack', attack)
        .addComponent('combo', combo)
        .addComponent('animationDriver', new PlayerAnimationDriver(animator, visual, movement, { dash, attack, combo }))
        .addComponent('animator', animator)
        .addComponent('dust', new DustEmitterComponent(root, movement, entityGroup))
        .addComponent('swordTrail', new SwordTrailComponent(sword, attack, entityGroup))
        .addComponent('health', health)
        .addComponent('hitFlash', hitFlash)
        .addComponent('deathFade', new DeathFadeComponent(root, xray));
}
