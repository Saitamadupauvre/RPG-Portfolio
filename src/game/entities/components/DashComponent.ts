import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { isGameplayActive } from '../../../core/pause';
import { keyFor } from '../../../domain/settings';
import { planGapLeap, slideMove, type GapLeap } from '../movement';
import { groundHeight } from '../../world/terrainField';
import type { MovementComponent } from './MovementComponent';
import { playSound } from '../../../audio/audio';

const DASH_SPEED = 14;
const DASH_DURATION = 0.18;
const DASH_COOLDOWN = 0.8;
/** Peak of the leap arc above the straight takeoff-to-landing line. */
const LEAP_HEIGHT = 0.6;

export class DashComponent implements Component {
    public readonly name = 'dash';

    private mesh: THREE.Object3D;
    private movement: MovementComponent;

    private direction = new THREE.Vector3();
    private remaining = 0;
    private cooldown = 0;
    /** Set when this dash clears a gap; it then flies a fixed line instead of sliding on the ground. */
    private leap: GapLeap | null = null;
    private leapTravelled = 0;

    constructor(mesh: THREE.Object3D, movement: MovementComponent) {
        this.mesh = mesh;
        this.movement = movement;
        window.addEventListener('keydown', this.onKeyDown);
    }

    public get isDashing(): boolean {
        return this.remaining > 0;
    }

    private onKeyDown = (event: KeyboardEvent) => {
        if (event.code !== keyFor('dash') || event.repeat) return;
        // Listeners are global, so a Space pressed while dead, paused or in a
        // menu would otherwise arm a dash that fires the moment play resumes.
        if (!isGameplayActive()) return;
        this.trigger();
    };

    public trigger() {
        if (this.cooldown > 0 || this.isDashing) return;

        const input = this.movement.getInputDirection();
        if (!input) return;

        this.direction.copy(input);
        this.cooldown = DASH_COOLDOWN;

        // Planned once, at takeoff: the whole line is checked before leaving the
        // ground, so a leap can never commit to a landing that turns out to be
        // a wall or a second gap halfway through.
        const { x, z } = this.mesh.position;
        this.leap = planGapLeap(x, z, this.direction, DASH_SPEED * DASH_DURATION);
        this.leapTravelled = 0;
        // Same speed either way; a leap just lasts long enough to reach its landing.
        this.remaining = this.leap ? this.leap.distance / DASH_SPEED : DASH_DURATION;

        this.movement.freeze('dash');
        playSound('dash');
    }

    public update(dt: number) {
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
        if (!this.isDashing) return;

        const step = Math.min(dt, this.remaining);
        this.remaining -= step;

        if (this.leap) {
            // Straight line, no terrain test: the gap is exactly what slideMove
            // would refuse, and the plan already vetted the landing.
            this.mesh.position.addScaledVector(this.direction, DASH_SPEED * step);
            this.leapTravelled += DASH_SPEED * step;
        } else {
            slideMove(this.mesh, this.direction, DASH_SPEED * step, this.movement.radius);
        }

        if (!this.isDashing) this.end();
    }

    /**
     * Height while airborne, or null on the ground. The world seats every
     * mover on the terrain each frame; this is how a leaping player opts out.
     * Never under the ground itself, so the run-up before the edge stays on it.
     */
    public airborneHeight(): number | null {
        if (!this.leap || !this.isDashing) return null;

        const progress = Math.min(1, this.leapTravelled / this.leap.distance);
        const line = THREE.MathUtils.lerp(this.leap.takeoffY, this.leap.landingY, progress);
        // 4·t·(1−t) is a parabola that is 0 at both ends and 1 in the middle.
        const arc = 4 * progress * (1 - progress) * LEAP_HEIGHT;
        const { x, z } = this.mesh.position;
        return Math.max(groundHeight(x, z), line + arc);
    }

    public cancel() {
        this.remaining = 0;
        this.end();
    }

    private end() {
        this.leap = null;
        this.movement.unfreeze('dash');
    }

    public dispose() {
        window.removeEventListener('keydown', this.onKeyDown);
    }
}
