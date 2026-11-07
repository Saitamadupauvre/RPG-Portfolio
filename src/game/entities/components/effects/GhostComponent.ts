import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { ghostMaterial } from '../../render/ghostMaterial';
import type { PropInstance } from '../../render/PropInstancer';

/**
 * Turns a prop see-through while the camera sits inside it, so a tree canopy
 * or a boulder between the camera and the player never fills the screen.
 * The test is the prop's world box, rebuilt only when the prop moved (the
 * editor) or its model has not arrived yet (empty box).
 *
 * An instanced prop (`instance`) has no meshes of its own to swap materials
 * on: while ghosted, its copy is swapped for real meshes under the root
 * (`setStandIn`), and those wear the ghost.
 */
export class GhostComponent implements Component {
    public readonly name = 'ghost';

    private root: THREE.Object3D;
    private instance?: PropInstance;
    private box = new THREE.Box3();
    private boxMatrix = new THREE.Matrix4();
    private ghosted = false;
    /** Each ghosted mesh and the material it wore before. */
    private swapped = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

    constructor(root: THREE.Object3D, instance?: PropInstance) {
        this.root = root;
        this.instance = instance;
    }

    public contains(point: THREE.Vector3): boolean {
        if (this.box.isEmpty() || !this.boxMatrix.equals(this.root.matrixWorld)) {
            this.measure();
            this.boxMatrix.copy(this.root.matrixWorld);
        }
        return this.box.containsPoint(point);
    }

    public setGhosted(ghosted: boolean) {
        if (ghosted === this.ghosted) return;
        this.ghosted = ghosted;

        if (!ghosted) {
            for (const [mesh, material] of this.swapped) mesh.material = material;
            this.swapped.clear();
            this.instance?.setStandIn(false);
            return;
        }

        this.instance?.setStandIn(true);
        this.root.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            this.swapped.set(object, object.material);
            object.material = Array.isArray(object.material)
                ? object.material.map(ghostMaterial)
                : ghostMaterial(object.material);
        });
    }

    private measure() {
        if (!this.instance) {
            this.box.setFromObject(this.root);
            return;
        }
        const local = this.instance.bounds();
        if (local) this.box.copy(local).applyMatrix4(this.root.matrixWorld);
        else this.box.makeEmpty();
    }
}
