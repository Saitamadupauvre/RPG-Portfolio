import * as THREE from 'three';
import type { HealthComponent } from '../../../domain/components/HealthComponent';
import { isBlocked, isInsideBounds, worldToCol, worldToRow } from '../../../domain/pathfinding/NavGrid';
import { getNavGrid } from '../../world/navigation';
import { turnToward } from '../movement';
import { DetectionComponent } from './DetectionComponent';
import type { EnemyBrain } from './EnemyBrain';
import type { RoamingAttacker } from './EnemyAttacker';
import { PathfindingComponent } from './PathfindingComponent';

export interface RoamOptions {
    /** How far from its spawn it ever runs: the patch of the map it lives in. */
    zone: number;
    /** Seconds it stands between two runs, [min, max]: a while when calm, a beat once it has seen the player. */
    pause: { calm: [number, number]; alert: [number, number] };
    /** How far from the player it darts about once alert, [min, max]: within reach of its attack, out of a sword's. */
    orbit: [number, number];
    /** Bolts when the player comes this close, as it does when hit. */
    startle: number;
    /** Chance, each time it stops near the player, that it attacks instead of darting on. */
    attackChance: number;
}

type RoamState = 'pause' | 'run' | 'attack';

/** Spots tried for each run before settling for the best one found. */
const TRIES = 12;
/** A calm run covers at least this share of the zone: a dash somewhere, not a shuffle on the spot. */
const MIN_RUN_SHARE = 0.35;
/** Shortest dart around the player: it keeps running rather than stopping and starting on the spot. */
const MIN_DART = 2.5;
/** Widest a dart strays from the critter's side of the player, radians: it circles, it does not cut through. */
const DART_SPREAD = THREE.MathUtils.degToRad(100);
/** Widest a bolt strays from straight away from the player, radians. */
const BOLT_SPREAD = THREE.MathUtils.degToRad(60);
/** Turn rate while it stands watching the player, radians per second. */
const WATCH_TURN = 10;
/** A run taking this many times longer than the straight line would has been blocked: it gives up on it. */
const STUCK_FACTOR = 2.5;

/**
 * A small critter's brain (the fox dragon). It lives in a patch of the map around its spawn:
 * runs to a random spot, stands a moment (sniffing, glancing about), runs on. Once the player
 * comes near it does not chase. It keeps darting from spot to spot around them, watching them
 * whenever it stops, and now and then, stopped within reach, it attacks. Coming too close or
 * landing a blow sends it bolting away (a blow breaks off the attack too), so catching it is
 * a matter of reading when it stops.
 *
 * Moves with the same PathfindingComponent and DetectionComponent as EnemyAIComponent; only
 * the choice of where to go differs.
 */
export class RoamAIComponent implements EnemyBrain {
    public readonly name = 'enemyAI';

    private mesh: THREE.Object3D;
    private player: THREE.Object3D;
    private health: HealthComponent;
    private attacker: RoamingAttacker;
    private options: RoamOptions;
    private origin: THREE.Vector3;
    private speed: number;

    private pathfinding: PathfindingComponent;
    private detection: DetectionComponent;

    private current: RoamState = 'pause';
    private timer = 0;
    /** How long the current pause lasts, or how long the current run may take before it counts as stuck. */
    private limit = 0;
    /** The current run is a bolt: the player closing in again does not turn it round. */
    private fleeing = false;
    private lastHp: number;

    private spot = new THREE.Vector3();
    private candidate = new THREE.Vector3();

    constructor(
        mesh: THREE.Object3D,
        player: THREE.Object3D,
        health: HealthComponent,
        origin: THREE.Vector3,
        moveSpeed: number,
        aggroRadius: number,
        deaggroRadius: number,
        attacker: RoamingAttacker,
        options: RoamOptions,
    ) {
        this.mesh = mesh;
        this.player = player;
        this.health = health;
        this.attacker = attacker;
        this.options = options;
        this.origin = origin.clone();
        this.speed = moveSpeed;
        this.lastHp = health.hp;

        this.pathfinding = new PathfindingComponent(mesh, moveSpeed);
        this.detection = new DetectionComponent(mesh, player, this.origin, aggroRadius, deaggroRadius);
    }

    public get isAggroed(): boolean {
        return this.detection.isAggroed;
    }

    public reset(origin: THREE.Vector3) {
        this.origin.copy(origin);
        this.detection.setOrigin(this.origin);
        this.attacker.reset();
        this.lastHp = this.health.hp;
        this.pause();
    }

    public update(dt: number) {
        this.detection.update();
        this.timer += dt;

        const hurt = this.health.hp < this.lastHp;
        this.lastHp = this.health.hp;
        const distance = this.distanceToPlayer();

        if (hurt) {
            this.attacker.interrupt();
            this.bolt();
        } else {
            switch (this.current) {
                case 'pause':
                    this.updatePause(distance, dt);
                    break;
                case 'run':
                    this.updateRun(distance);
                    break;
                case 'attack':
                    // The attacker owns the body until it is done; then off it runs.
                    if (!this.attacker.busy) this.runTo(this.dartSpot(this.spot));
                    break;
            }
        }

        this.pathfinding.update(dt);
        this.attacker.update?.(dt);
    }

    private updatePause(distance: number, dt: number) {
        if (this.isAggroed) {
            if (distance < this.options.startle) {
                this.bolt();
                return;
            }
            // Whenever it stops, it turns to watch the player.
            turnToward(this.mesh, this.headingToPlayer(), WATCH_TURN * dt);
        }
        if (this.timer < this.limit) return;

        if (!this.isAggroed) {
            this.runTo(this.calmSpot(this.spot));
            return;
        }
        if (Math.random() < this.options.attackChance) {
            // Out of range, behind cover or still catching its breath: the attacker declines and it darts on.
            this.attacker.engage(this.player.position, distance);
            if (this.attacker.busy) {
                this.current = 'attack';
                return;
            }
        }
        this.runTo(this.dartSpot(this.spot));
    }

    private updateRun(distance: number) {
        if (this.isAggroed && !this.fleeing && distance < this.options.startle) {
            this.bolt();
            return;
        }
        if (this.pathfinding.hasArrived || this.timer > this.limit) this.pause();
    }

    private pause() {
        const [min, max] = this.isAggroed ? this.options.pause.alert : this.options.pause.calm;
        this.current = 'pause';
        this.timer = 0;
        this.limit = THREE.MathUtils.randFloat(min, max);
        this.fleeing = false;
        this.pathfinding.clearTarget();
    }

    private runTo(spot: THREE.Vector3, fleeing = false) {
        this.current = 'run';
        this.timer = 0;
        this.limit = (STUCK_FACTOR * flatDistance(this.mesh.position, spot)) / this.speed + 0.5;
        this.fleeing = fleeing;
        // Cleared first: a new target on top of an old one waits for the next repath, still running the old path.
        this.pathfinding.clearTarget();
        this.pathfinding.setTarget(spot);
    }

    private bolt() {
        this.runTo(this.boltSpot(this.spot), true);
    }

    /** Anywhere in the zone, far enough from where it stands to make a real run. */
    private calmSpot(out: THREE.Vector3): THREE.Vector3 {
        const { zone } = this.options;
        for (let i = 0; i < TRIES; i++) {
            // The square root spreads the spots evenly over the disc instead of bunching them at its centre.
            this.inZone(out, Math.random() * Math.PI * 2, zone * Math.sqrt(Math.random()));
            if (this.isOpen(out) && flatDistance(out, this.mesh.position) >= zone * MIN_RUN_SHARE) return out;
        }
        return out.copy(this.origin);
    }

    /**
     * A spot `orbit` away from the player on the critter's side of them, so it circles round
     * rather than cutting past them. With the player outside its patch, it wanders it instead.
     */
    private dartSpot(out: THREE.Vector3): THREE.Vector3 {
        const [near, far] = this.options.orbit;
        const side = this.headingToPlayer() + Math.PI;
        for (let i = 0; i < TRIES; i++) {
            const angle = side + THREE.MathUtils.randFloatSpread(2 * DART_SPREAD);
            const radius = THREE.MathUtils.randFloat(near, far);
            const { x, z } = this.player.position;
            out.set(x + Math.sin(angle) * radius, this.origin.y, z + Math.cos(angle) * radius);
            if (this.isOpen(out) && this.isInZone(out) && flatDistance(out, this.mesh.position) >= MIN_DART) return out;
        }
        return this.calmSpot(out);
    }

    /** Away from the player, as far as its patch allows; cornered, the spot of the zone farthest from them. */
    private boltSpot(out: THREE.Vector3): THREE.Vector3 {
        const { zone } = this.options;
        const away = this.headingToPlayer() + Math.PI;
        let best = -1;
        for (let i = 0; i < TRIES; i++) {
            if (i < TRIES / 2) {
                const angle = away + THREE.MathUtils.randFloatSpread(2 * BOLT_SPREAD);
                const length = zone * THREE.MathUtils.randFloat(0.5, 1);
                const { x, z } = this.mesh.position;
                this.candidate.set(x + Math.sin(angle) * length, this.origin.y, z + Math.cos(angle) * length);
            } else {
                this.inZone(this.candidate, Math.random() * Math.PI * 2, zone * Math.sqrt(Math.random()));
            }
            if (!this.isOpen(this.candidate) || !this.isInZone(this.candidate)) continue;
            const score = flatDistance(this.candidate, this.player.position);
            if (score > best) {
                best = score;
                out.copy(this.candidate);
            }
        }
        return best >= 0 ? out : out.copy(this.origin);
    }

    /** The point `radius` from home along `angle`. */
    private inZone(out: THREE.Vector3, angle: number, radius: number): THREE.Vector3 {
        return out.set(this.origin.x + Math.sin(angle) * radius, this.origin.y, this.origin.z + Math.cos(angle) * radius);
    }

    private isInZone(point: THREE.Vector3): boolean {
        return flatDistance(point, this.origin) <= this.options.zone;
    }

    /** On the map and on open ground: no trunk, rock or water under it. */
    private isOpen(point: THREE.Vector3): boolean {
        const grid = getNavGrid();
        return isInsideBounds(grid, point.x, point.z) && !isBlocked(grid, worldToCol(grid, point.x), worldToRow(grid, point.z));
    }

    private headingToPlayer(): number {
        return Math.atan2(this.player.position.x - this.mesh.position.x, this.player.position.z - this.mesh.position.z);
    }

    private distanceToPlayer(): number {
        return flatDistance(this.mesh.position, this.player.position);
    }
}

function flatDistance(a: THREE.Vector3, b: THREE.Vector3): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
}
