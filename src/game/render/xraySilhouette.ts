import * as THREE from 'three';

/**
 * Drawn after everything else, water (10) included: transparent objects sort
 * by renderOrder first, so whatever hides the body is already in the depth
 * buffer when the silhouette tests against it.
 */
const SILHOUETTE_RENDER_ORDER = 20;
/** Every character writes the same stencil value: no silhouette is ever drawn over a character's own visible pixels. */
const STENCIL_REF = 1;
const SILHOUETTE_TAG = 'xraySilhouette';
/**
 * Characters draw after every other opaque mesh. Three sorts opaque meshes by
 * renderOrder, then material id, and only then by depth, so a prop whose
 * material was created after the player's would draw after it: the player
 * would already have stamped the stencil over its whole outline, and the
 * silhouette would skip the pixels the prop then covers.
 */
const CHARACTER_RENDER_ORDER = 1;

const materials = new Map<number, THREE.MeshBasicMaterial>();

/**
 * Flat colour drawn only where the body is hidden. Two tests together:
 * - `GreaterDepth`: only fragments behind something already in the depth buffer.
 * - stencil != 1: never over a character's own pixels, so an arm in front of
 *   the chest does not turn the chest grey through the arm.
 * Fully opaque, so overlapping hidden parts never stack into darker patches;
 * still flagged transparent so it draws in the transparent pass, after water.
 * One material per colour, shared by every twin that uses it.
 */
function silhouetteMaterial(color: number): THREE.MeshBasicMaterial {
    let material = materials.get(color);
    if (!material) {
        material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            depthFunc: THREE.GreaterDepth,
            depthWrite: false,
            stencilWrite: true,
            stencilRef: STENCIL_REF,
            stencilFunc: THREE.NotEqualStencilFunc,
            stencilFail: THREE.KeepStencilOp,
            stencilZFail: THREE.KeepStencilOp,
            stencilZPass: THREE.KeepStencilOp,
        });
        // A flat overlay: tone mapping would shift the colour with the exposure.
        material.toneMapped = false;
        materials.set(color, material);
    }
    return material;
}

/**
 * A see-through-walls silhouette for one character. Every mesh under `root`
 * gets a twin that shares its geometry (and skeleton, for skinned meshes) and
 * is its child with an identity transform, so it follows every animation for
 * free. Call `refresh()` after a model loads to give the new meshes theirs.
 * Needs a renderer created with `stencil: true`.
 */
export class XraySilhouette {
    private root: THREE.Object3D;
    private material: THREE.MeshBasicMaterial;
    private twins: THREE.Mesh[] = [];
    private enabled: boolean;

    constructor(root: THREE.Object3D, color: number, enabled = true) {
        this.root = root;
        this.material = silhouetteMaterial(color);
        this.enabled = enabled;
        this.refresh();
    }

    public setEnabled(enabled: boolean) {
        if (enabled === this.enabled) return;
        this.enabled = enabled;
        for (const twin of this.twins) twin.visible = enabled;
    }

    /** Twins the meshes that do not have one yet; meshes removed since (a placeholder) took theirs along. */
    public refresh() {
        this.twins = this.twins.filter((twin) => isUnder(twin, this.root));

        const meshes: THREE.Mesh[] = [];
        this.root.traverse((object) => {
            if (!(object instanceof THREE.Mesh) || object.userData[SILHOUETTE_TAG]) return;
            if (object.children.some((child) => child.userData[SILHOUETTE_TAG])) return;
            // Overlays that already ignore depth (health bars) show through walls on their own.
            if (!depthTested(object.material)) return;
            meshes.push(object);
        });

        // Collected first: adding children while traversing would visit the twins too.
        for (const mesh of meshes) {
            markStencil(mesh.material);
            mesh.renderOrder = CHARACTER_RENDER_ORDER;

            const twin = mesh instanceof THREE.SkinnedMesh
                ? bindSkinnedTwin(mesh, this.material)
                : new THREE.Mesh(mesh.geometry, this.material);
            twin.userData[SILHOUETTE_TAG] = true;
            twin.renderOrder = SILHOUETTE_RENDER_ORDER;
            twin.castShadow = false;
            twin.receiveShadow = false;
            twin.frustumCulled = mesh.frustumCulled;
            twin.visible = this.enabled;
            mesh.add(twin);
            this.twins.push(twin);
        }
    }
}

function depthTested(material: THREE.Material | THREE.Material[]): boolean {
    return (Array.isArray(material) ? material : [material]).every((each) => each.depthTest);
}

function isUnder(object: THREE.Object3D, root: THREE.Object3D): boolean {
    for (let node: THREE.Object3D | null = object; node; node = node.parent) {
        if (node === root) return true;
    }
    return false;
}

function bindSkinnedTwin(mesh: THREE.SkinnedMesh, material: THREE.Material): THREE.SkinnedMesh {
    const twin = new THREE.SkinnedMesh(mesh.geometry, material);
    twin.bind(mesh.skeleton, mesh.bindMatrix);
    return twin;
}

/** The character stamps the stencil wherever it is drawn; silhouettes skip those pixels. */
function markStencil(material: THREE.Material | THREE.Material[]) {
    for (const each of Array.isArray(material) ? material : [material]) {
        each.stencilWrite = true;
        each.stencilRef = STENCIL_REF;
        each.stencilFunc = THREE.AlwaysStencilFunc;
        each.stencilZPass = THREE.ReplaceStencilOp;
    }
}
