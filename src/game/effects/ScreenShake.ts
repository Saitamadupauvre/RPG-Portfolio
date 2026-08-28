import * as THREE from 'three';

export class ScreenShake {
    private duration = 0;
    private elapsed = 0;
    private intensity = 0;
    private offset = new THREE.Vector3();

    public trigger(intensity: number, duration: number) {
        this.intensity = intensity;
        this.duration = duration;
        this.elapsed = 0;
    }

    public getOffset(dt: number): THREE.Vector3 {
        if (this.elapsed >= this.duration) return this.offset.set(0, 0, 0);

        this.elapsed += dt;
        const magnitude = this.intensity * (1 - this.elapsed / this.duration);

        return this.offset.set(
            (Math.random() * 2 - 1) * magnitude,
            (Math.random() * 2 - 1) * magnitude,
            (Math.random() * 2 - 1) * magnitude,
        );
    }
}
