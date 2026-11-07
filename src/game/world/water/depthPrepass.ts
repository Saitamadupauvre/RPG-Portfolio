import * as THREE from 'three';
import { SHORE_LAYER } from '@game/render/layers';

/**
 * Fraction of the drawing buffer's size the depth is rendered at. Full size:
 * at half, each depth texel (nearest-sampled, a depth texture cannot be
 * filtered) covered 2x2 screen pixels, and the foam came out as stair steps
 * set off the bank, plain to see on a phone. The prepass draws only the
 * terrain and rocks (SHORE_LAYER), so full size stays cheap. The water shader
 * samples it in 0..1 screen UVs, so its resolution uniform is the drawing size.
 */
const DEPTH_SCALE = 1;

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
        const [w, h] = scaled(width, height);
        this.target = new THREE.WebGLRenderTarget(w, h);
        this.depthTexture = new THREE.DepthTexture(w, h);
        // 24-bit integer depth is plenty for shore foam and half the bandwidth of
        // a 32-bit float buffer, which is also slower to sample on many GPUs.
        this.depthTexture.type = THREE.UnsignedIntType;
        this.target.depthTexture = this.depthTexture;
    }

    public setSize(width: number, height: number) {
        this.target.setSize(...scaled(width, height));
    }

    public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
        // Only what the shore can meet: the terrain and the rocks (SHORE_LAYER).
        // Each mesh keeps its own material rather than a cheap
        // `scene.overrideMaterial = MeshDepthMaterial`, since an override would
        // not run a shader's own vertex displacement. The water, grass, wind
        // streaks, editor volumes, props and characters are all off that layer:
        // a bush at the waterline is not worth a foam ring, and drawing them
        // all here cost more than the whole rest of the frame.
        // The mask is restored as it was, since the editor layer is on only in EDITOR.
        const previousTarget = renderer.getRenderTarget();
        const previousLayers = camera.layers.mask;
        camera.layers.set(SHORE_LAYER);
        renderer.setRenderTarget(this.target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(previousTarget);
        camera.layers.mask = previousLayers;
    }

    public dispose() {
        this.target.dispose();
        this.depthTexture.dispose();
    }
}

function scaled(width: number, height: number): [number, number] {
    return [Math.max(1, Math.round(width * DEPTH_SCALE)), Math.max(1, Math.round(height * DEPTH_SCALE))];
}
