import * as THREE from 'three';
import { isInsideBounds } from '../domain/pathfinding/NavGrid';
import { TrailRenderer, type TrailRendererOptions } from './effects/TrailRenderer';
import { loadModel } from './entities/loadModel';
import { createLitMaterial } from './render/materials';
import { PALETTE } from './render/palette';
import { getNavGrid } from './world/navigation';
import { isInsideObstacle } from './world/obstacles';
import { getTileGrid, groundHeight } from './world/terrainField';

const ARROW_URL = 'models/enemy-arrow.glb';
/**
 * Nock to tip, in world units: `ARROW_LENGTH` in tools/blender/make_enemies.py at the
 * skeleton's in-game scale, so the arrow that flies matches the one that was drawn.
 */
const ARROW_LENGTH = 0.54;
/** Distance an arrow flies dead straight; past it gravity takes over and brings it down. */
const STRAIGHT_FLIGHT = 16;
const GRAVITY = 20;
/** A shot that has hit nothing by then is dropped, wherever it is. */
const MAX_FLIGHT_TIME = 4;
/** Seconds a spent arrow stays planted in the ground or a tree, then how long it takes to shrink away. */
const STUCK_TIME = 2.5;
const VANISH_TIME = 0.25;
/** How far a planted arrow sinks into what stopped it, as a share of its length. */
const EMBED = 0.25;
/** Spacing of the samples along a flight or a line of fire: finer than the thinnest trunk is wide. */
const LINE_STEP = 0.2;
/** Halvings of the last step that pin an impact onto the surface it met: to about 0.01. */
const SURFACE_ITERATIONS = 4;

const ARROW_TRAIL: TrailRendererOptions = {
    time: 0.16,
    width: 0.16,
    // Leaves the fletching at its own width, swells, then thins to a point: a wake, not a flat ribbon.
    widthCurve: (t) => Math.min(1, 0.4 + 5 * t) * (1 - t),
    gradient: [
        { t: 0, color: PALETTE.cream, alpha: 0.95 },
        { t: 0.35, color: PALETTE.berry, alpha: 0.7 },
        { t: 1, color: PALETTE.berry, alpha: 0 },
    ],
    minVertexDistance: 0.15,
    maxPoints: 20,
    retractTime: 0.08,
};

const UP = new THREE.Vector3(0, 1, 0);

/**
 * free: pooled. flying: in the air. stuck: planted where it landed. vanishing: shrinking
 * away. spent: gone from view (it hit the player or sank) while its trail pulls in.
 */
type ArrowState = 'free' | 'flying' | 'stuck' | 'vanishing' | 'spent';

interface Arrow {
    /** Origin at the nock, shaft along local +Y: turning it is one setFromUnitVectors. */
    pivot: THREE.Group;
    trail: TrailRenderer;
    state: ArrowState;
    velocity: THREE.Vector3;
    travelled: number;
    timer: number;
    damage: number;
}

/**
 * Every arrow in the air, pooled. Straight flight, a trail streaking behind each one,
 * hits on the target's hurtbox, and the ones that miss plant themselves in the ground or
 * in whatever obstacle they meet, then fade. Damage is not dealt here: `update` reports
 * the hit and the caller (CombatSystem) applies it the same way it applies a sword.
 */
export class ProjectileSystem {
    private parent: THREE.Object3D;
    private arrows: Arrow[] = [];
    private placeholderGeometry: THREE.BufferGeometry;
    private placeholderMaterial: THREE.Material;

    private ray = new THREE.Ray();
    private previousTip = new THREE.Vector3();
    private tip = new THREE.Vector3();
    private direction = new THREE.Vector3();
    private hitPoint = new THREE.Vector3();
    private impactPoint = new THREE.Vector3();

    constructor(parent: THREE.Object3D) {
        this.parent = parent;
        // Stand-in until the model arrives; the cache makes every later load of it instant.
        this.placeholderGeometry = new THREE.CylinderGeometry(0.02, 0.02, ARROW_LENGTH, 5).translate(0, ARROW_LENGTH / 2, 0);
        this.placeholderMaterial = createLitMaterial({ color: PALETTE.wheat });
    }

    /** Looses an arrow from its nock position along `direction` (normalized). */
    public fire(from: THREE.Vector3, direction: THREE.Vector3, speed: number, damage: number) {
        const arrow = this.arrows.find((candidate) => candidate.state === 'free') ?? this.createArrow();

        arrow.state = 'flying';
        arrow.velocity.copy(direction).multiplyScalar(speed);
        arrow.travelled = 0;
        arrow.timer = 0;
        arrow.damage = damage;
        arrow.pivot.position.copy(from);
        arrow.pivot.quaternion.setFromUnitVectors(UP, direction);
        arrow.pivot.scale.setScalar(1);
        arrow.pivot.visible = true;
        arrow.trail.clear();
    }

    /**
     * Moves every arrow. One flying through `target` this frame calls `onHit` with its
     * damage and where it struck, then disappears.
     */
    public update(dt: number, target: THREE.Box3, onHit: (damage: number, point: THREE.Vector3) => void) {
        for (const arrow of this.arrows) {
            if (arrow.state === 'free') continue;
            if (arrow.state === 'flying') this.fly(arrow, dt, target, onHit);
            // Emitting while it flies, then the head stays on the nock while the tail pulls in.
            // Skipped once pulled in: an idle trail would still rewrite its mesh every frame.
            if (arrow.state === 'flying' || arrow.trail.isActive) {
                arrow.trail.update(dt, arrow.pivot.position, arrow.state === 'flying');
            }
            this.age(arrow, dt);
        }
    }

    /** After the flight: a planted arrow waits, then shrinks away; a spent one waits for its trail. */
    private age(arrow: Arrow, dt: number) {
        switch (arrow.state) {
            case 'stuck':
                arrow.timer += dt;
                if (arrow.timer >= STUCK_TIME) {
                    arrow.state = 'vanishing';
                    arrow.timer = 0;
                }
                break;
            case 'vanishing':
                arrow.timer += dt;
                arrow.pivot.scale.setScalar(Math.max(0, 1 - arrow.timer / VANISH_TIME));
                if (arrow.timer >= VANISH_TIME) this.free(arrow);
                break;
            case 'spent':
                if (!arrow.trail.isActive) this.free(arrow);
                break;
        }
    }

    /** Drops every arrow at once: a rest or a respawn must not leave shots in the air. */
    public clear() {
        for (const arrow of this.arrows) this.free(arrow);
    }

    private fly(arrow: Arrow, dt: number, target: THREE.Box3, onHit: (damage: number, point: THREE.Vector3) => void) {
        this.tipOf(arrow, this.previousTip);

        if (arrow.travelled > STRAIGHT_FLIGHT) arrow.velocity.y -= GRAVITY * dt;
        const step = arrow.velocity.length() * dt;
        arrow.pivot.position.addScaledVector(arrow.velocity, dt);
        arrow.travelled += step;
        arrow.timer += dt;
        this.direction.copy(arrow.velocity).normalize();
        arrow.pivot.quaternion.setFromUnitVectors(UP, this.direction);
        const tip = this.tipOf(arrow, this.tip);

        // Both swept along this frame's path, so neither a fast arrow nor a slow frame can step
        // over a body or a trunk; whichever the path meets first takes the arrow.
        const impact = findImpact(this.previousTip, tip, this.impactPoint);
        this.ray.set(this.previousTip, this.direction);
        const crossed = this.ray.intersectBox(target, this.hitPoint) !== null && this.previousTip.distanceTo(this.hitPoint) <= step;
        if (!crossed) this.hitPoint.copy(tip);
        const struck = crossed || target.containsPoint(tip);
        if (struck && (!impact || this.previousTip.distanceTo(this.hitPoint) <= this.previousTip.distanceTo(this.impactPoint))) {
            onHit(arrow.damage, this.hitPoint);
            this.spend(arrow);
            return;
        }

        const grid = getNavGrid();
        if (!isInsideBounds(grid, tip.x, tip.z) || arrow.timer > MAX_FLIGHT_TIME) {
            this.spend(arrow);
            return;
        }

        const waterLevel = getTileGrid().map.waterLevel;
        if (waterLevel !== undefined && tip.y < waterLevel && groundHeight(tip.x, tip.z) < waterLevel) {
            this.spend(arrow);
            return;
        }

        if (impact) this.plant(arrow, this.impactPoint);
    }

    /** Leaves the arrow sunk into what it hit at `contact`, tail out. */
    private plant(arrow: Arrow, contact: THREE.Vector3) {
        arrow.state = 'stuck';
        arrow.timer = 0;
        arrow.pivot.position.copy(contact).addScaledVector(this.direction, EMBED * ARROW_LENGTH - ARROW_LENGTH);
    }

    private spend(arrow: Arrow) {
        arrow.state = 'spent';
        arrow.pivot.visible = false;
    }

    private free(arrow: Arrow) {
        arrow.state = 'free';
        arrow.pivot.visible = false;
        arrow.trail.clear();
    }

    private tipOf(arrow: Arrow, out: THREE.Vector3): THREE.Vector3 {
        return out.copy(UP).applyQuaternion(arrow.pivot.quaternion).multiplyScalar(ARROW_LENGTH).add(arrow.pivot.position);
    }

    private createArrow(): Arrow {
        const pivot = new THREE.Group();
        const placeholder = new THREE.Mesh(this.placeholderGeometry, this.placeholderMaterial);
        placeholder.castShadow = true;
        pivot.add(placeholder);
        this.parent.add(pivot);

        loadModel(ARROW_URL, { height: ARROW_LENGTH, anchor: 'origin' })
            .then(({ object }) => {
                pivot.remove(placeholder);
                pivot.add(object);
            })
            .catch((error) => console.error(`[arrows] ${ARROW_URL} failed to load, keeping placeholder`, error));

        const arrow: Arrow = {
            pivot,
            trail: new TrailRenderer(this.parent, ARROW_TRAIL),
            state: 'free',
            velocity: new THREE.Vector3(),
            travelled: 0,
            timer: 0,
            damage: 0,
        };
        this.arrows.push(arrow);
        return arrow;
    }
}

const sample = new THREE.Vector3();

/**
 * Whether an arrow loosed at `from` would reach `to` in a straight line: no ground rising
 * above the line (a hill, a cliff face) and no tree, rock or landmark tall enough to be in
 * the way. Water does not block it: arrows fly over what a walker cannot cross. The two
 * ends are not tested, so a shooter or a target brushing an obstacle does not block itself.
 */
export function hasLineOfFire(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const grid = getNavGrid();
    const steps = Math.ceil(from.distanceTo(to) / LINE_STEP);
    for (let i = 1; i < steps; i++) {
        sample.lerpVectors(from, to, i / steps);
        if (!isInsideBounds(grid, sample.x, sample.z) || isSolid(sample)) return false;
    }
    return true;
}

/**
 * Marches from `from` to `to` and writes into `out` the first point where the path enters
 * the ground or an obstacle, narrowed down to the surface itself: every arrow then sinks in
 * by the same depth, however long its last step was.
 */
function findImpact(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3): boolean {
    const steps = Math.ceil(from.distanceTo(to) / LINE_STEP);
    for (let i = 1; i <= steps; i++) {
        if (!isSolid(out.lerpVectors(from, to, i / steps))) continue;

        let outside = (i - 1) / steps;
        let inside = i / steps;
        for (let j = 0; j < SURFACE_ITERATIONS; j++) {
            const middle = (outside + inside) / 2;
            if (isSolid(out.lerpVectors(from, to, middle))) inside = middle;
            else outside = middle;
        }
        out.lerpVectors(from, to, inside);
        return true;
    }
    return false;
}

/** Underground, or inside a trunk, a rock or a landmark. */
function isSolid(point: THREE.Vector3): boolean {
    const above = point.y - groundHeight(point.x, point.z);
    return above <= 0 || isInsideObstacle(point.x, point.z, above);
}
