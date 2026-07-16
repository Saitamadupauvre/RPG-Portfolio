import * as THREE from 'three';
import { Experience } from "../Experience";

export class Environment {
    private experience: Experience;
    private ambient: THREE.AmbientLight;
    private directionalLight: THREE.DirectionalLight;

    constructor(experience: Experience) {
        this.experience = experience;

        this.ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.directionalLight = new THREE.DirectionalLight(0xfffdf0, 1.5);

        this.experience.scene.add(this.ambient);
        this.experience.scene.add(this.directionalLight); this.directionalLight.position.set(5, 10, 7);
    }
}
