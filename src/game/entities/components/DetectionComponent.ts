import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';

export interface DetectionHooks {
    onAggro?: () => void;
    onDeaggro?: () => void;
}

// Aggros when the player enters aggroRadius, deaggros when the player strays deaggroRadius
// away from this entity's spawn origin (not from the entity's current position) — so a chase
// can't drag on forever but also isn't cancelled just by the enemy wandering off origin mid-chase.
export class DetectionComponent implements Component {
    public readonly name = 'detection';

    private mesh: THREE.Object3D;
    private target: THREE.Object3D;
    private origin: THREE.Vector3;
    private aggroRadius: number;
    private deaggroRadius: number;
    private hooks: DetectionHooks;

    private aggroed = false;

    constructor(mesh: THREE.Object3D, target: THREE.Object3D, origin: THREE.Vector3, aggroRadius: number, deaggroRadius: number, hooks: DetectionHooks = {}) {
        this.mesh = mesh;
        this.target = target;
        this.origin = origin.clone();
        this.aggroRadius = aggroRadius;
        this.deaggroRadius = deaggroRadius;
        this.hooks = hooks;
    }

    public get isAggroed(): boolean {
        return this.aggroed;
    }

    public setOrigin(origin: THREE.Vector3) {
        this.origin.copy(origin);
        this.aggroed = false;
    }

    public update() {
        if (!this.aggroed) {
            if (this.mesh.position.distanceTo(this.target.position) <= this.aggroRadius) {
                this.aggroed = true;
                this.hooks.onAggro?.();
            }
            return;
        }

        if (this.origin.distanceTo(this.target.position) > this.deaggroRadius) {
            this.aggroed = false;
            this.hooks.onDeaggro?.();
        }
    }
}
