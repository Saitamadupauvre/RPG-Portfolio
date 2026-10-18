import * as THREE from 'three';
import type { MapEntity } from '../../data/MapEntity';
import { groundHeight } from '../world/terrainField';

const PAINT_COLOR = 0x3ae6c9;
const ERASE_COLOR = 0xe6503a;
/** Lifts the ring off the ground it marks, so it never z-fights. */
const HOVER = 0.05;

/** The circle under the cursor showing what a brush stroke will reach. */
export class BrushCursor {
    private geometry = new THREE.RingGeometry(0.94, 1, 64);
    private material = new THREE.MeshBasicMaterial({
        color: PAINT_COLOR,
        transparent: true,
        opacity: 0.9,
        // Drawn over everything: a ring half buried in a slope or in grass is
        // exactly when it is most needed.
        depthTest: false,
        depthWrite: false,
    });
    private mesh = new THREE.Mesh(this.geometry, this.material);

    constructor(scene: THREE.Object3D) {
        this.geometry.rotateX(-Math.PI / 2);
        this.mesh.renderOrder = 999;
        this.mesh.visible = false;
        scene.add(this.mesh);
    }

    public show(point: THREE.Vector3, radius: number, erase: boolean) {
        this.mesh.position.set(point.x, point.y + HOVER, point.z);
        this.mesh.scale.setScalar(radius);
        this.material.color.setHex(erase ? ERASE_COLOR : PAINT_COLOR);
        this.mesh.visible = true;
    }

    public hide() {
        this.mesh.visible = false;
    }

    public dispose() {
        this.mesh.removeFromParent();
        this.geometry.dispose();
        this.material.dispose();
    }
}

/**
 * Stand-ins for the entities a scatter stroke has placed but not yet built.
 * Rebuilding the world once per stamp would stutter, so the real models only
 * appear on release; until then each copy is a cheap marker of its footprint.
 */
export class ScatterGhosts {
    private group = new THREE.Group();
    private geometry = new THREE.ConeGeometry(0.3, 1, 6);
    private material = new THREE.MeshBasicMaterial({ color: PAINT_COLOR, transparent: true, opacity: 0.6 });

    constructor(scene: THREE.Object3D) {
        this.geometry.translate(0, 0.5, 0);
        scene.add(this.group);
    }

    public add(entities: MapEntity[]) {
        for (const entity of entities) {
            const [x, , z] = entity.position;
            const ghost = new THREE.Mesh(this.geometry, this.material);
            ghost.position.set(x, groundHeight(x, z), z);
            ghost.scale.setScalar(entity.scale?.[0] ?? 1);
            this.group.add(ghost);
        }
    }

    /** Just detaches: every ghost shares this instance's geometry and material. */
    public clear() {
        this.group.clear();
    }

    public dispose() {
        this.group.removeFromParent();
        this.geometry.dispose();
        this.material.dispose();
    }
}
