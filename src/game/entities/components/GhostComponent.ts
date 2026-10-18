import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { ghostMaterial } from '../../render/ghostMaterial';

/**
 * Turns a prop see-through while the camera sits inside it, so a tree canopy
 * or a boulder between the camera and the player never fills the screen.
 * The test is the prop's world box, rebuilt only when the prop moved (the
 * editor) or its model has not arrived yet (empty box).
 */
export class GhostComponent implements Component {
    public readonly name = 'ghost';

    private root: THREE.Object3D;
    private box = new THREE.Box3();
    private boxMatrix = new THREE.Matrix4();
    /** Each ghosted mesh and the material it wore before. */
    private swapped = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

    constructor(root: THREE.Object3D) {
        this.root = root;
    }

    public contains(point: THREE.Vector3): boolean {
        if (this.box.isEmpty() || !this.boxMatrix.equals(this.root.matrixWorld)) {
            this.box.setFromObject(this.root);
            this.boxMatrix.copy(this.root.matrixWorld);
        }
        return this.box.containsPoint(point);
    }

    public setGhosted(ghosted: boolean) {
        if (ghosted === this.swapped.size > 0) return;

        if (!ghosted) {
            for (const [mesh, material] of this.swapped) mesh.material = material;
            this.swapped.clear();
            return;
        }

        this.root.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            this.swapped.set(object, object.material);
            object.material = Array.isArray(object.material)
                ? object.material.map(ghostMaterial)
                : ghostMaterial(object.material);
        });
    }
}
