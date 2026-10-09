import * as THREE from 'three';
import type { Experience } from '../Experience';

const SKY_COLOR = 0x9adcf2;
/** Bounce light colour. Saturated grass green, so shadowed sides read as colour, never grey. */
const BOUNCE_COLOR = 0x8cc472;
const SUN_COLOR = 0xfff0c2;
/**
 * A second, dim light aimed back from the sky side, so the unlit half of every
 * mesh reads blue-tinted instead of muddy. To revisit with the palette pass.
 */
const FILL_COLOR = 0x8fb8dd;
/** Sun position relative to the point it lights. Fixed, so the light direction never changes. */
const SUN_OFFSET = new THREE.Vector3(10, 15, 8);
/**
 * Half-size of the square the shadow map covers, centred on the player. The
 * map follows the player rather than covering the whole terrain: same 2048²
 * texels over a far smaller area means much crisper shadows, and a terrain
 * resized in the editor can no longer fall outside the frustum.
 */
const SHADOW_HALF_SIZE = 45;
const SHADOW_MAP_SIZE = 2048;
/** World units per shadow texel. */
const SHADOW_TEXEL = (SHADOW_HALF_SIZE * 2) / SHADOW_MAP_SIZE;

export class Environment {
    private experience: Experience;
    private hemisphere: THREE.HemisphereLight;
    private sun: THREE.DirectionalLight;
    private fill: THREE.DirectionalLight;
    private lightRight = new THREE.Vector3();
    private lightUp = new THREE.Vector3();
    private focus = new THREE.Vector3();

    constructor(experience: Experience) {
        this.experience = experience;

        this.experience.scene.background = new THREE.Color(SKY_COLOR);
        // Far enough that saturated colour survives across the view instead of
        // fading to sky within a few chunks.
        this.experience.scene.fog = new THREE.Fog(SKY_COLOR, 40, 95);

        // Ambient-dominated: the hemisphere does most of the work so nothing
        // ever falls into near-black, and the sun only adds shape on top.
        this.hemisphere = new THREE.HemisphereLight(SKY_COLOR, BOUNCE_COLOR, 0.95);

        this.sun = new THREE.DirectionalLight(SUN_COLOR, 1.6);
        this.sun.position.copy(SUN_OFFSET);
        this.sun.castShadow = true;
        // The direct lever for "less dark shadow": scales how much light the
        // shadow removes, instead of flooding the scene with ambient to
        // compensate (which would flatten everything).
        this.sun.shadow.intensity = 0.5;
        this.sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = SUN_OFFSET.length() + SHADOW_HALF_SIZE * 2;
        this.sun.shadow.camera.left = -SHADOW_HALF_SIZE;
        this.sun.shadow.camera.right = SHADOW_HALF_SIZE;
        this.sun.shadow.camera.top = SHADOW_HALF_SIZE;
        this.sun.shadow.camera.bottom = -SHADOW_HALF_SIZE;
        // The light's own right/up axes, for snapping the follow point below.
        const lightBasis = new THREE.Matrix4().lookAt(SUN_OFFSET, new THREE.Vector3(), THREE.Object3D.DEFAULT_UP);
        lightBasis.extractBasis(this.lightRight, this.lightUp, new THREE.Vector3());
        // normalBias offsets the lookup along the surface normal, which clears
        // shadow acne on curved meshes without the peter-panning a large
        // constant bias causes.
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.03;

        this.fill = new THREE.DirectionalLight(FILL_COLOR, 0.45);
        this.fill.position.set(-8, 6, -10);

        this.experience.scene.add(this.hemisphere);
        this.experience.scene.add(this.sun);
        // The target must be in the scene graph or its matrix never updates.
        this.experience.scene.add(this.sun.target);
        this.experience.scene.add(this.fill);
    }

    /**
     * Centres the shadow map on `point`. The centre is snapped to whole shadow
     * texels along the light's own axes: moving it by a fraction of a texel
     * would resample every shadow edge differently each frame, and they would
     * crawl and shimmer as the player walks.
     */
    public followShadows(point: THREE.Vector3) {
        const focus = this.focus.copy(point);
        const alongRight = focus.dot(this.lightRight);
        const alongUp = focus.dot(this.lightUp);
        focus.addScaledVector(this.lightRight, Math.round(alongRight / SHADOW_TEXEL) * SHADOW_TEXEL - alongRight);
        focus.addScaledVector(this.lightUp, Math.round(alongUp / SHADOW_TEXEL) * SHADOW_TEXEL - alongUp);

        this.sun.target.position.copy(focus);
        this.sun.position.copy(focus).add(SUN_OFFSET);
    }
}

