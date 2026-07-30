import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { HealthComponent } from '../../../domain/components/HealthComponent';

const WIDTH = 0.8;
const HEIGHT = 0.1;
const DRAIN_SPEED = 0.6; // hp-ratio units per second the white trail takes to catch up

// Billboarded bg+fill+drain bar parented to the owner mesh (so pooling's mesh.visible toggle
// hides it for free). Counter-rotates against the owner's world rotation each frame so it
// always faces the camera. Hidden while at full hp; on damage a white trail bar holds the
// pre-hit width and drains down to the new fill level instead of snapping instantly.
export class HealthBarComponent implements Component {
    public readonly name = 'healthBar';

    private group: THREE.Group;
    private fill: THREE.Mesh;
    private drain: THREE.Mesh;
    private ownerMesh: THREE.Object3D;
    private camera: THREE.Camera;
    private health: HealthComponent;
    private drainRatio = -1;
    private ownerWorldQuat = new THREE.Quaternion();

    constructor(ownerMesh: THREE.Object3D, camera: THREE.Camera, health: HealthComponent, yOffset: number) {
        this.ownerMesh = ownerMesh;
        this.camera = camera;
        this.health = health;

        const bgGeometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false });
        const bg = new THREE.Mesh(bgGeometry, bgMaterial);
        bg.renderOrder = 997;

        const drainGeometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);
        const drainMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
        this.drain = new THREE.Mesh(drainGeometry, drainMaterial);
        this.drain.renderOrder = 998;
        this.drain.position.z = 0.0005;

        const fillGeometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);
        const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x33dd33, depthTest: false });
        this.fill = new THREE.Mesh(fillGeometry, fillMaterial);
        this.fill.renderOrder = 999;
        this.fill.position.z = 0.001;

        this.group = new THREE.Group();
        this.group.position.y = yOffset;
        this.group.add(bg, this.drain, this.fill);
        ownerMesh.add(this.group);
    }

    // Called by the pool when an entity is (re)spawned so a fresh full-hp bar doesn't
    // inherit a drain trail from whatever this pooled entity looked like before.
    public reset() {
        this.drainRatio = -1;
    }

    public update(dt: number) {
        this.ownerMesh.getWorldQuaternion(this.ownerWorldQuat);
        this.group.quaternion.copy(this.ownerWorldQuat.invert()).multiply(this.camera.quaternion);

        const ratio = Math.max(0, this.health.hp / this.health.maxHp);
        if (this.drainRatio < 0) this.drainRatio = ratio;
        this.drainRatio = ratio < this.drainRatio ? Math.max(ratio, this.drainRatio - DRAIN_SPEED * dt) : ratio;

        this.setBar(this.fill, ratio);
        this.setBar(this.drain, this.drainRatio);
        this.group.visible = ratio < 1 || this.drainRatio < 1;
    }

    private setBar(mesh: THREE.Mesh, ratio: number) {
        mesh.scale.x = ratio;
        mesh.position.x = -(WIDTH * (1 - ratio)) / 2;
    }
}
