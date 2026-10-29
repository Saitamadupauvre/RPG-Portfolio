import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';

/**
 * The bridge from a character's gameplay components to its animator — what a Unity script does
 * when it calls `animator.SetBool(...)` every frame. One driver per kind of character, because
 * each reads different gameplay (a combo, a lunge, a bow); the controller decides what the
 * parameters mean. Updates after whatever moves or attacks, and before the animator.
 */
export interface AnimationDriver extends Component {
    /** Back to standing: a pooled, rested or respawned character must not come back mid-swing. */
    reset(): void;
}

/**
 * How fast a body really crosses the ground, measured from where it stood last frame. Enemies
 * walk on this rather than on "has a path": a path blocked by a wall would otherwise leave
 * them waddling on the spot.
 */
export class GroundSpeed {
    private body: THREE.Object3D;
    private last = new THREE.Vector3();
    private hasLast = false;

    constructor(body: THREE.Object3D) {
        this.body = body;
    }

    /** Units per second since the previous sample; 0 on the first one after a reset. Call once per frame. */
    public sample(dt: number): number {
        const { x, z } = this.body.position;
        const speed = this.hasLast && dt > 0 ? Math.hypot(x - this.last.x, z - this.last.z) / dt : 0;
        this.last.copy(this.body.position);
        this.hasLast = true;
        return speed;
    }

    /** Forgets the last position, so a teleport (spawn, respawn) does not read as a sprint. */
    public reset() {
        this.hasLast = false;
    }
}
