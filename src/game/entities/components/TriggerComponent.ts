import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { TriggerAction } from '../../../data/MapEntity';
import { runTriggerAction } from '../../../domain/triggerActions';

const local = new THREE.Vector3();
const toLocal = new THREE.Matrix4();

/**
 * Fires its action on the frame the player steps into the volume. Leaving re-arms
 * it; whether a second entry does anything is the action's call (a tutorial shows once).
 */
export class TriggerComponent implements Component {
    public readonly name = 'trigger';

    private volume: THREE.Object3D;
    private action: TriggerAction;
    private inside = false;

    /** `volume` is the unit box: x and z in [-0.5, 0.5], y in [0, 1], before its transform. */
    constructor(volume: THREE.Object3D, action: TriggerAction) {
        this.volume = volume;
        this.action = action;
    }

    public test(point: THREE.Vector3) {
        const inside = this.contains(point);
        if (inside && !this.inside) runTriggerAction(this.action);
        this.inside = inside;
    }

    /**
     * Brings the point into the box's own space, where the test is three range
     * checks whatever the box's rotation and size: cheaper to write and to get
     * right than rotating the box's corners out into the world.
     */
    private contains(point: THREE.Vector3): boolean {
        this.volume.updateWorldMatrix(true, false);
        local.copy(point).applyMatrix4(toLocal.copy(this.volume.matrixWorld).invert());
        return Math.abs(local.x) <= 0.5 && Math.abs(local.z) <= 0.5 && local.y >= 0 && local.y <= 1;
    }
}
