import * as THREE from 'three';
import { Experience } from "../Experience";

const SKY_COLOR = 0x9adcf2;
/** Bounce light colour. Saturated grass green, so shadowed sides read as colour, never grey. */
const BOUNCE_COLOR = 0x8cc472;
const SUN_COLOR = 0xfff0c2;
/**
 * A second, dim light aimed back from the sky side. Cel shading collapses the
 * unlit half of every mesh into one flat band; a cool fill keeps that band
 * blue-tinted (the way cartoon shadows are painted) instead of muddy.
 */
const FILL_COLOR = 0x8fb8dd;

export class Environment {
    private experience: Experience;
    private hemisphere: THREE.HemisphereLight;
    private sun: THREE.DirectionalLight;
    private fill: THREE.DirectionalLight;

    constructor(experience: Experience) {
        this.experience = experience;

        this.experience.scene.background = new THREE.Color(SKY_COLOR);
        // Pushed further out than before: cartoon looks want saturated colour to
        // survive across the view, not fade to sky within a few chunks.
        this.experience.scene.fog = new THREE.Fog(SKY_COLOR, 40, 95);

        // Ambient-dominated: the hemisphere does most of the work so nothing
        // ever falls into near-black, and the sun only adds shape on top.
        this.hemisphere = new THREE.HemisphereLight(SKY_COLOR, BOUNCE_COLOR, 0.95);

        this.sun = new THREE.DirectionalLight(SUN_COLOR, 1.6);
        this.sun.position.set(10, 15, 8);
        this.sun.castShadow = true;
        // The direct lever for "less dark shadow": scales how much light the
        // shadow removes, instead of flooding the scene with ambient to
        // compensate (which would flatten everything).
        // Higher than the previous soft 0.4: with toon banding the shadow terminator
        // is a hard edge, and a weak shadow next to a hard edge reads as a bug.
        this.sun.shadow.intensity = 0.5;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 50;
        this.sun.shadow.camera.left = -20;
        this.sun.shadow.camera.right = 20;
        this.sun.shadow.camera.top = 20;
        this.sun.shadow.camera.bottom = -20;
        // normalBias offsets the lookup along the surface normal, which clears
        // shadow acne on curved meshes without the peter-panning a large
        // constant bias causes.
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.03;

        this.fill = new THREE.DirectionalLight(FILL_COLOR, 0.45);
        this.fill.position.set(-8, 6, -10);

        this.experience.scene.add(this.hemisphere);
        this.experience.scene.add(this.sun);
        this.experience.scene.add(this.fill);
    }
}
