import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { MovementComponent } from './MovementComponent';
import type { DashComponent } from './DashComponent';
import type { AttackComponent } from './AttackComponent';
import type { ComboComponent } from './ComboComponent';

/** Stride cycle: one full sine period = one left+right step pair. */
const WALK_FREQUENCY = 8.5;
const WALK_BOB = 0.075;
const WALK_ROLL = 0.09;
const WALK_YAW = 0.11;
const WALK_LEAN = 0.13;
const WALK_SQUASH = 0.06;

const IDLE_FREQUENCY = 2.1;
const IDLE_BREATHE = 0.028;
const IDLE_SWAY = 0.025;

/** How fast a 0..1 weight chases its target, in "fraction closed per second". Higher = snappier. */
const MOVE_BLEND_RATE = 12;
const DASH_BLEND_RATE = 22;
const BANK_BLEND_RATE = 9;

const BANK_STRENGTH = 0.055;
const BANK_MAX = 0.35;

const DASH_LEAN = 0.42;
const DASH_STRETCH = 0.18;

const ATTACK_TWIST = 0.55;

/**
 * Hand poses, in the visual group's local space (origin at body centre, feet at -0.9, top at +0.9).
 *
 * Heights are derived from the model itself, not guessed: the source bean is 5.03 units tall and
 * is fitted to 1.8, so local_y = model_y * 0.358 - 0.9. Its arm attach points sit at model y 1.59
 * (= -0.33 local, below centre) and the face/helmet occupies model y 2.0-4.3 (= -0.18..+0.64
 * local, within x +/-0.4). So the hand lives *low and wide*: anything above y 0.15 or inside
 * |x| 0.4 is inside the head.
 *
 * The character faces +Z, so with Y up the sword arm (its right) is on -X. The sword hangs off
 * the hand's local +Z, so hand rotation aims the blade: +X pitches the tip down, +Y sweeps left.
 */
export const HAND_REST = new THREE.Vector3(-0.44, -0.33, 0.18);
const HAND_REST_ROTATION = new THREE.Vector3(0.35, -0.12, 0);

interface HandPose {
    position: THREE.Vector3;
    rotation: THREE.Vector3;
}

interface SwingArc {
    windup: HandPose;
    /** Midpoint the hand is dragged through, so the swing reads as an arc and not a straight slide. */
    mid: HandPose;
    follow: HandPose;
}

function pose(px: number, py: number, pz: number, rx: number, ry: number, rz: number): HandPose {
    return { position: new THREE.Vector3(px, py, pz), rotation: new THREE.Vector3(rx, ry, rz) };
}

/** One arc per combo move, indexed by `ComboComponent.moveIndex`. */
const SWING_ARCS: SwingArc[] = [
    // 0 - flat horizontal slash at shoulder height, right to left. Stays at hand height throughout.
    {
        windup: pose(-0.60, -0.26, -0.32, 0.10, -1.30, -0.25),
        mid: pose(-0.26, -0.30, 0.60, 0.05, -0.10, 0),
        follow: pose(0.46, -0.36, 0.26, 0.05, 1.20, 0.30),
    },
    // 1 - diagonal chop. Raised, but held out at |x| 0.58 so the arm passes beside the helmet
    // (which only reaches x -0.39) rather than through it, and never above y 0.12.
    {
        windup: pose(-0.58, 0.10, -0.28, -0.95, -0.50, -0.35),
        mid: pose(-0.32, -0.10, 0.54, 0.10, -0.05, 0),
        follow: pose(0.24, -0.58, 0.36, 1.05, 0.40, 0.45),
    },
];

export interface AnimationDeps {
    hand?: THREE.Object3D;
    dash?: DashComponent;
    attack?: AttackComponent;
    combo?: ComboComponent;
}

/**
 * Procedural locomotion for a rig-less model. Everything is written to a visual child group
 * (and the hand), never to the root, so collision, hitboxes and the camera stay jitter-free.
 *
 * Every pose is rebuilt from scratch each frame and blended by weights rather than accumulated,
 * so states can overlap (walking into a dash mid-swing) without drifting out of alignment.
 */
export class AnimationComponent implements Component {
    public readonly name = 'animation';

    private visual: THREE.Object3D;
    private movement: MovementComponent;
    private deps: AnimationDeps;

    private strideTime = 0;
    private idleTime = 0;
    private moveWeight = 0;
    private dashWeight = 0;
    private bank = 0;
    private previousYaw = 0;
    private handPosition = new THREE.Vector3().copy(HAND_REST);
    private handRotation = new THREE.Vector3().copy(HAND_REST_ROTATION);
    private targetPosition = new THREE.Vector3();
    private targetRotation = new THREE.Vector3();

    constructor(visual: THREE.Object3D, movement: MovementComponent, deps: AnimationDeps = {}) {
        this.visual = visual;
        this.movement = movement;
        this.deps = deps;
        this.previousYaw = visual.parent?.rotation.y ?? 0;
    }

    public update(dt: number) {
        if (dt <= 0) return;

        const moving = this.movement.isMoving();
        const dashing = this.deps.dash?.isDashing ?? false;

        this.idleTime += dt;
        // Stride only advances while moving, so stopping and restarting resumes the gait mid-step
        // instead of snapping back to phase zero.
        if (moving) this.strideTime += dt;

        this.moveWeight = damp(this.moveWeight, moving ? 1 : 0, MOVE_BLEND_RATE, dt);
        this.dashWeight = damp(this.dashWeight, dashing ? 1 : 0, DASH_BLEND_RATE, dt);
        this.updateBank(dt);

        const stride = this.strideTime * WALK_FREQUENCY;
        const step = Math.sin(stride);
        const bounce = Math.abs(step); // 0 at foot plant, 1 at mid-stride lift
        const walk = this.moveWeight;
        const idle = 1 - walk;

        // --- position ---
        const walkY = (bounce - 0.5) * 2 * WALK_BOB;
        const idleY = Math.sin(this.idleTime * IDLE_FREQUENCY) * 0.012;
        this.visual.position.y = walkY * walk + idleY * idle - this.dashWeight * 0.08;
        // Lateral weight shift: the body drifts over the planted foot.
        this.visual.position.x = step * 0.035 * walk;

        // --- rotation ---
        const idleSway = Math.sin(this.idleTime * 0.8) * IDLE_SWAY;
        this.visual.rotation.z = step * WALK_ROLL * walk + idleSway * idle + this.bank;
        this.visual.rotation.x = WALK_LEAN * walk + DASH_LEAN * this.dashWeight;
        // Counter-rotation at half stride frequency: shoulders swing once per full step pair.
        this.visual.rotation.y = Math.sin(stride * 0.5) * WALK_YAW * walk + this.attackTwist();

        // --- scale ---
        const squash = bounce * WALK_SQUASH * walk;
        const breathe = Math.sin(this.idleTime * IDLE_FREQUENCY) * IDLE_BREATHE * idle;
        const scaleY = 1 - squash + breathe - this.dashWeight * 0.1;
        // Counter the vertical change on the horizontal axes to fake volume preservation.
        const horizontal = 1 + (1 - scaleY) * 0.5;
        this.visual.scale.set(horizontal, scaleY, horizontal + DASH_STRETCH * this.dashWeight);

        this.updateHand(dt, stride, walk);
    }

    /** Leans the body into turns, driven by how fast the root yaw is actually changing. */
    private updateBank(dt: number) {
        const yaw = this.visual.parent?.rotation.y ?? 0;
        const raw = yaw - this.previousYaw;
        const delta = Math.atan2(Math.sin(raw), Math.cos(raw));
        this.previousYaw = yaw;

        const target = THREE.MathUtils.clamp((delta / dt) * BANK_STRENGTH, -BANK_MAX, BANK_MAX);
        this.bank = damp(this.bank, target * this.moveWeight, BANK_BLEND_RATE, dt);
    }

    /**
     * Torso twist. Both arcs sweep right to left, so the body always coils the same way:
     * negative yaw pulls the sword shoulder (-X) back during windup, positive whips it through.
     */
    private attackTwist(): number {
        const windup = this.deps.combo?.windupProgress;
        if (windup != null) return -easeOutCubic(windup) * ATTACK_TWIST;

        const swing = this.deps.attack?.swingProgress;
        if (swing != null) {
            return THREE.MathUtils.lerp(-ATTACK_TWIST, ATTACK_TWIST * 0.6, easeInOutCubic(swing));
        }

        return 0;
    }

    private updateHand(dt: number, stride: number, walk: number) {
        const hand = this.deps.hand;
        if (!hand) return;

        const windup = this.deps.combo?.windupProgress;
        const swing = this.deps.attack?.swingProgress;
        const arc = SWING_ARCS[(this.deps.combo?.moveIndex ?? 0) % SWING_ARCS.length];

        let rate: number;

        if (windup != null) {
            // Ease-out on the way back reads as "cocking": fast pull, settled hold.
            const t = easeOutCubic(windup);
            this.targetPosition.copy(HAND_REST).lerp(arc.windup.position, t);
            this.targetRotation.copy(HAND_REST_ROTATION).lerp(arc.windup.rotation, t);
            rate = 26;
        } else if (swing != null) {
            // Ease-*in*-out through the arc: the blade accelerates out of the cock, then the
            // arm decelerates into follow-through. A plain ease-out started at full speed and
            // read as a teleport.
            const t = easeInOutCubic(swing);
            samplePose(arc, t, this.targetPosition, this.targetRotation);
            rate = 45;
        } else {
            // Arm swings opposite the torso yaw, one cycle per step pair.
            const armSwing = Math.sin(stride * 0.5 + Math.PI) * 0.42 * walk;
            this.targetPosition.copy(HAND_REST);
            this.targetPosition.z += armSwing * 0.35;
            this.targetPosition.y += Math.abs(armSwing) * 0.05;
            this.targetRotation.copy(HAND_REST_ROTATION);
            this.targetRotation.x -= armSwing * 0.9;
            rate = 14;
        }

        const t = 1 - Math.exp(-rate * dt);
        this.handPosition.lerp(this.targetPosition, t);
        this.handRotation.lerp(this.targetRotation, t);
        hand.position.copy(this.handPosition);
        hand.rotation.set(this.handRotation.x, this.handRotation.y, this.handRotation.z);
    }
}

/** Frame-rate independent exponential smoothing toward `target`. */
function damp(current: number, target: number, rate: number, dt: number): number {
    return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function easeOutCubic(t: number): number {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    return 1 - Math.pow(1 - clamped, 3);
}

function easeInOutCubic(t: number): number {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    return clamped < 0.5 ? 4 * clamped ** 3 : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/** Walks the three-point arc: windup to mid over the first half, mid to follow over the second. */
function samplePose(arc: SwingArc, t: number, position: THREE.Vector3, rotation: THREE.Vector3) {
    if (t < 0.5) {
        const local = t * 2;
        position.copy(arc.windup.position).lerp(arc.mid.position, local);
        rotation.copy(arc.windup.rotation).lerp(arc.mid.rotation, local);
    } else {
        const local = (t - 0.5) * 2;
        position.copy(arc.mid.position).lerp(arc.follow.position, local);
        rotation.copy(arc.mid.rotation).lerp(arc.follow.rotation, local);
    }
}
