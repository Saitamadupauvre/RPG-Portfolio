import * as THREE from 'three';
import { loadModel, type ModelFitOptions } from '@game/entities/loadModel';
import type { TintableMaterial } from './materials/materials';

/** How one model is drawn: every copy of it shares these. */
export type BatchOptions = {
    url: string;
    fit: ModelFitOptions;
    castShadow: boolean;
    /** Called once per part material when the model arrives (shader patches); `modelHeight` is in the model's own units. */
    prepare?: (material: TintableMaterial, modelHeight: number) => void;
    /** Called on every part mesh, the stand-ins included (render hooks). */
    decorate?: (mesh: THREE.Mesh) => void;
};

/** What makes one copy differ from the others, decided once the model is known. */
export type InstanceLook = {
    /** One colour per part, in `parts` order; the shared materials are white, so this is the whole colour. */
    colors: THREE.Color[];
    /** Extra scale over the fitted model, so equal models still differ in shape. */
    stretch: THREE.Vector3;
};

/** One placed copy: its owner's world matrix is where it stands. */
export type PropInstance = {
    /** The copy's box in its owner's frame, or null until the model arrives. */
    bounds(): THREE.Box3 | null;
    /**
     * Swaps the instance for real meshes under the owner (and back), for the
     * one thing an instance cannot do: wear a material of its own (the ghost).
     */
    setStandIn(on: boolean): void;
    remove(): void;
};

type Part = {
    mesh: THREE.InstancedMesh;
    /** The part relative to the fitted model's root. */
    local: THREE.Matrix4;
    material: TintableMaterial;
};

type Slot = {
    owner: THREE.Object3D;
    look: InstanceLook;
    /** Fit + stretch: the owner's frame to the model's root. */
    inner: THREE.Matrix4;
    index: number;
    /** What was last written, to skip the copies that did not move. */
    written: THREE.Matrix4;
    shown: boolean;
    standIn: THREE.Group | null;
    removed: boolean;
};

const START_CAPACITY = 64;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const scratch = new THREE.Matrix4();

/**
 * Every copy of one model, drawn in one call per part (a tree is canopy + trunk:
 * two calls for all the trees of that model). Instead of a mesh and cloned
 * materials per tree, which was ~3 draw calls per tree per pass.
 *
 * The copies follow their owner (the entity's own group, still in the scene
 * and still moved by the editor gizmo): `sync` compares each owner's world
 * matrix with the one last written, so a static forest costs a matrix compare
 * per tree and no upload.
 */
class ModelBatch {
    public parts: Part[] = [];
    private slots: Slot[] = [];
    private bounds = new THREE.Box3();
    private capacity = START_CAPACITY;
    private root: THREE.Group;
    private options: BatchOptions;

    constructor(root: THREE.Group, options: BatchOptions, template: THREE.Object3D, materials: TintableMaterial[]) {
        this.root = root;
        this.options = options;

        // The fitted model's own size, in the units its shader sees.
        const modelHeight = options.fit.height / template.scale.y;
        for (const material of materials) {
            // The colour lives per instance; white leaves it untouched.
            material.color.set(0xffffff);
            options.prepare?.(material, modelHeight);
        }

        template.updateMatrixWorld(true);
        this.bounds.setFromObject(template);
        template.traverse((child) => {
            if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return;
            const mesh = new THREE.InstancedMesh(child.geometry, child.material, this.capacity);
            this.setup(mesh, child);
            this.parts.push({ mesh, local: child.matrixWorld.clone(), material: child.material as TintableMaterial });
        });
    }

    /** The materials in `parts` order, for the caller to pick colours by name. */
    public get materials(): TintableMaterial[] {
        return this.parts.map((part) => part.material);
    }

    public add(owner: THREE.Object3D, look: InstanceLook): Slot {
        if (this.slots.length === this.capacity) this.grow();

        const inner = new THREE.Matrix4().makeScale(look.stretch.x, look.stretch.y, look.stretch.z);
        const slot: Slot = {
            owner, look, inner, index: this.slots.length, written: new THREE.Matrix4(), shown: false, standIn: null, removed: false,
        };
        this.slots.push(slot);
        for (const [i, part] of this.parts.entries()) {
            part.mesh.setColorAt(slot.index, look.colors[i]);
            part.mesh.count = this.slots.length;
            if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
        }
        owner.updateWorldMatrix(true, false);
        this.write(slot);
        return slot;
    }

    /** Swap-remove: the last copy takes the freed index, so the drawn range stays packed. */
    public remove(slot: Slot) {
        if (slot.removed) return;
        slot.removed = true;
        this.clearStandIn(slot);

        const last = this.slots.pop()!;
        if (last !== slot) {
            last.index = slot.index;
            this.slots[slot.index] = last;
            for (const [i, part] of this.parts.entries()) part.mesh.setColorAt(last.index, last.look.colors[i]);
            this.write(last);
        }
        for (const part of this.parts) {
            part.mesh.count = this.slots.length;
            if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
        }
    }

    public ownerAt(index: number): THREE.Object3D | null {
        return this.slots[index]?.owner ?? null;
    }

    public boundsOf(slot: Slot): THREE.Box3 {
        return this.bounds.clone().applyMatrix4(slot.inner);
    }

    public setStandIn(slot: Slot, on: boolean) {
        if (slot.removed || on === (slot.standIn !== null)) return;
        if (!on) {
            this.clearStandIn(slot);
            this.write(slot);
            return;
        }

        const group = new THREE.Group();
        group.matrixAutoUpdate = false;
        group.matrix.copy(slot.inner);
        for (const [i, part] of this.parts.entries()) {
            const material = part.material.clone() as TintableMaterial;
            // `clone` leaves the shader patch behind.
            material.onBeforeCompile = part.material.onBeforeCompile;
            material.customProgramCacheKey = part.material.customProgramCacheKey;
            material.color.copy(slot.look.colors[i]);
            const mesh = new THREE.Mesh(part.mesh.geometry, material);
            mesh.matrixAutoUpdate = false;
            mesh.matrix.copy(part.local);
            mesh.castShadow = part.mesh.castShadow;
            this.options.decorate?.(mesh);
            group.add(mesh);
        }
        slot.standIn = group;
        slot.owner.add(group);
        this.write(slot);
    }

    /** Rewrites the copies whose owner moved, was hidden or shown since the last frame. */
    public sync() {
        for (const slot of this.slots) {
            const shown = this.isShown(slot);
            if (shown === slot.shown && (!shown || slot.written.equals(slot.owner.matrixWorld))) continue;
            this.write(slot);
        }
    }

    public dispose() {
        for (const part of this.parts) {
            this.root.remove(part.mesh);
            part.mesh.dispose();
        }
    }

    private isShown(slot: Slot) {
        return slot.owner.visible && slot.standIn === null;
    }

    private write(slot: Slot) {
        slot.shown = this.isShown(slot);
        slot.written.copy(slot.owner.matrixWorld);
        const base = slot.shown ? scratch.multiplyMatrices(slot.owner.matrixWorld, slot.inner) : HIDDEN;
        const matrix = new THREE.Matrix4();
        for (const part of this.parts) {
            part.mesh.setMatrixAt(slot.index, slot.shown ? matrix.multiplyMatrices(base, part.local) : HIDDEN);
            part.mesh.instanceMatrix.needsUpdate = true;
            // Recomputed lazily, by the editor's raycast only (culling is off).
            part.mesh.boundingSphere = null;
            part.mesh.boundingBox = null;
        }
    }

    private clearStandIn(slot: Slot) {
        if (!slot.standIn) return;
        slot.owner.remove(slot.standIn);
        slot.standIn.traverse((object) => {
            if (object instanceof THREE.Mesh) (object.material as THREE.Material).dispose();
        });
        slot.standIn = null;
    }

    /** An InstancedMesh's capacity is fixed: past it, a bigger one replaces it, carrying the data over. */
    private grow() {
        this.capacity *= 2;
        for (const part of this.parts) {
            const old = part.mesh;
            const mesh = new THREE.InstancedMesh(old.geometry, part.material, this.capacity);
            (mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array);
            if (old.instanceColor) mesh.setColorAt(0, new THREE.Color());
            if (old.instanceColor && mesh.instanceColor) (mesh.instanceColor.array as Float32Array).set(old.instanceColor.array);
            mesh.count = old.count;
            this.setup(mesh, old);
            this.root.remove(old);
            old.dispose();
            part.mesh = mesh;
        }
    }

    private setup(mesh: THREE.InstancedMesh, source: THREE.Mesh) {
        mesh.name = `${this.options.url}:${source.name}`;
        mesh.castShadow = this.options.castShadow;
        mesh.receiveShadow = source.receiveShadow;
        // One batch spans every loaded chunk: its bounding sphere would almost never leave the view.
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.options.decorate?.(mesh);
        this.root.add(mesh);
    }
}

/**
 * Draws the trees and bushes as instanced batches, one per model. Module-level
 * like `enemyPool`: factories are called with map data only, and the world
 * adds `root` to its entity group (so the batches hide with the world) and
 * calls `sync` every frame.
 */
class PropInstancer {
    public readonly root = new THREE.Group();
    private batches = new Map<string, Promise<ModelBatch>>();
    private ready: ModelBatch[] = [];

    constructor() {
        this.root.name = 'prop-instances';
    }

    /**
     * Places a copy following `owner`. Returns at once; the copy shows once the
     * model has loaded, with the look `lookFor` picks from the part materials.
     */
    public place(options: BatchOptions, owner: THREE.Object3D, lookFor: (materials: TintableMaterial[]) => InstanceLook): PropInstance {
        let slot: Slot | null = null;
        let batch: ModelBatch | null = null;
        let removed = false;

        this.batchFor(options)
            .then((loaded) => {
                if (removed) return;
                batch = loaded;
                slot = loaded.add(owner, lookFor(loaded.materials));
            })
            .catch((error) => console.error(`[props] ${options.url} failed to load`, error));

        return {
            bounds: () => (batch && slot ? batch.boundsOf(slot) : null),
            setStandIn: (on) => {
                if (batch && slot) batch.setStandIn(slot, on);
            },
            remove: () => {
                removed = true;
                if (batch && slot) batch.remove(slot);
            },
        };
    }

    public sync() {
        for (const batch of this.ready) batch.sync();
    }

    /** The owner of the copy a raycast hit, if it hit one (the editor's picking). */
    public ownerOf(hit: THREE.Intersection): THREE.Object3D | null {
        if (!(hit.object instanceof THREE.InstancedMesh) || hit.instanceId === undefined) return null;
        for (const batch of this.ready) {
            if (!batch.parts.some((part) => part.mesh === hit.object)) continue;
            return batch.ownerAt(hit.instanceId);
        }
        return null;
    }

    private batchFor(options: BatchOptions): Promise<ModelBatch> {
        let pending = this.batches.get(options.url);
        if (!pending) {
            pending = loadModel(options.url, options.fit).then(
                ({ object, materials }) => {
                    const batch = new ModelBatch(this.root, options, object, materials);
                    this.ready.push(batch);
                    return batch;
                },
                (error: unknown) => {
                    this.batches.delete(options.url);
                    throw error;
                },
            );
            this.batches.set(options.url, pending);
        }
        return pending;
    }
}

export const propInstancer = new PropInstancer();
