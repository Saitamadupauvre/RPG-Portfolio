import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { TrailRenderer, type TrailRendererOptions } from '../../effects/TrailRenderer';

/**
 * Streaks a trail behind its owner while `isEmitting` holds (a dash, a lunge),
 * then pulls it back into the owner.
 * Must update after whatever moves the owner, so the trail's head sits on the body.
 */
export class DashTrailComponent implements Component {
    public readonly name = 'dashTrail';

    private owner: THREE.Object3D;
    private isEmitting: () => boolean;
    /** Point on the owner, in its local space, the trail runs through (body centre). */
    private anchor: THREE.Vector3;
    private trail: TrailRenderer;
    private scratch = new THREE.Vector3();

    constructor(owner: THREE.Object3D, parent: THREE.Object3D, isEmitting: () => boolean, options: TrailRendererOptions, anchor = new THREE.Vector3()) {
        this.owner = owner;
        this.isEmitting = isEmitting;
        this.anchor = anchor.clone();
        this.trail = new TrailRenderer(parent, options);
    }

    /** Drops the ribbon at once: a pooled or respawned owner must not drag an old trail along. */
    public reset() {
        this.trail.clear();
    }

    public update(dt: number) {
        const emitting = this.isEmitting();
        if (!emitting && !this.trail.isActive) return;

        // matrixWorld is refreshed at render time, so it still holds last frame's spot; the
        // owner moved since. Parents only: re-posing the whole skeleton here would be wasted.
        this.owner.updateWorldMatrix(true, false);
        // Fed even after the dash ends: the head stays on the body while the tail pulls in.
        this.trail.update(dt, this.owner.localToWorld(this.scratch.copy(this.anchor)), emitting);
    }

    public dispose() {
        this.trail.dispose();
    }
}
