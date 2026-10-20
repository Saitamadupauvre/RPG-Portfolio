import * as THREE from 'three';
import { EDITOR_LAYER, GRASS_LAYER } from '../../render/layers';

/**
 * Renders the scene's depth (water hidden) into a texture the water shader can
 * compare itself against — the standard stylized-water technique (Unity's
 * `_CameraDepthTexture`, Genshin/BOTW-style shores): foam and colour read what
 * is actually behind the water pixel by pixel, so they hug any bank exactly,
 * including a steep or overhanging one, instead of a separately-sampled
 * heightfield that can drift out of step with the rendered geometry.
 */
export class WaterDepthPrepass {
    public readonly target: THREE.WebGLRenderTarget;
    public readonly depthTexture: THREE.DepthTexture;

    constructor(width: number, height: number) {
        this.target = new THREE.WebGLRenderTarget(width, height);
        this.depthTexture = new THREE.DepthTexture(width, height);
        // 24-bit integer depth is plenty for shore foam and half the bandwidth of
        // a 32-bit float buffer, which is also slower to sample on many GPUs.
        this.depthTexture.type = THREE.UnsignedIntType;
        this.target.depthTexture = this.depthTexture;
    }

    public setSize(width: number, height: number) {
        this.target.setSize(width, height);
    }

    public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, water: THREE.Object3D) {
        const wasVisible = water.visible;
        water.visible = false;

        // Rendered with each mesh's own material rather than a cheap
        // `scene.overrideMaterial = MeshDepthMaterial`. The grass patches its
        // vertex shader to bend blades (see grassMaterial.ts), and an override
        // material does not run that displacement — grass would write depth at
        // its undisplaced positions and the shore foam would read the wrong
        // distance. `customDepthMaterial` is no escape hatch either: three only
        // consults it during shadow passes, not for `overrideMaterial`.
        //
        // Grass is left out entirely, though: it was most of the frame's
        // triangles, drawn a second time just for this. Blades are a fraction
        // of a unit tall, so the foam reading the ground under them instead is
        // not visible, while skipping them halves the field's cost.
        // Editor-only volumes are left out too: the shore would foam around trigger boxes.
        // The mask is restored as it was, not re-enabled, since the editor layer is on only in EDITOR.
        const previousTarget = renderer.getRenderTarget();
        const previousLayers = camera.layers.mask;
        camera.layers.disable(GRASS_LAYER);
        camera.layers.disable(EDITOR_LAYER);
        renderer.setRenderTarget(this.target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(previousTarget);
        camera.layers.mask = previousLayers;

        water.visible = wasVisible;
    }

    public dispose() {
        this.target.dispose();
        this.depthTexture.dispose();
    }
}
