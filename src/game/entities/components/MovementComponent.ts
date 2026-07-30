import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { isBlocked, worldToCol, worldToRow } from '../../../domain/pathfinding/NavGrid';
import { getNavGrid } from '../../world/navigation';

export class MovementComponent implements Component {
    public readonly name = 'movement';

    private keys = new Set<string>();
    private forward: THREE.Vector3;
    private right: THREE.Vector3;
    private mesh: THREE.Object3D;
    private speed: number;
    private facingAngle = 0;
    private locked = false;
    private turnSpeed: number;

    constructor(mesh: THREE.Object3D, cameraOffset: THREE.Vector3, speed: number, turnSpeed = Math.PI * 10) {
        this.mesh = mesh;
        this.speed = speed;
        this.turnSpeed = turnSpeed;
        this.forward = new THREE.Vector3(-cameraOffset.x, 0, -cameraOffset.z).normalize();
        this.right = new THREE.Vector3(-this.forward.z, 0, this.forward.x);

        window.addEventListener('keydown', (e) => this.keys.add(e.code));
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    }

    // While locked (e.g. mid-attack), rotation stays put so an aim rotation isn't overwritten.
    public setLocked(locked: boolean) {
        this.locked = locked;
    }

    public update(dt: number) {
        const move = new THREE.Vector3();
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(this.forward);
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(this.forward);
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(this.right);
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(this.right);

        if (move.lengthSq() > 0) {
            move.normalize();
            this.facingAngle = Math.atan2(move.x, move.z);
            this.moveWithCollision(move, this.speed * dt);

            if (!this.locked) this.rotateTowards(this.facingAngle, dt);
        }
    }

    // Slides along walls instead of stopping dead: try the full move, then each axis alone.
    private moveWithCollision(direction: THREE.Vector3, distance: number) {
        const grid = getNavGrid();
        const { x, z } = this.mesh.position;

        const full = { x: x + direction.x * distance, z: z + direction.z * distance };
        if (!this.isWorldBlocked(grid, full.x, full.z)) {
            this.mesh.position.x = full.x;
            this.mesh.position.z = full.z;
            return;
        }

        if (!this.isWorldBlocked(grid, full.x, z)) {
            this.mesh.position.x = full.x;
        } else if (!this.isWorldBlocked(grid, x, full.z)) {
            this.mesh.position.z = full.z;
        }
    }

    private isWorldBlocked(grid: ReturnType<typeof getNavGrid>, x: number, z: number): boolean {
        return isBlocked(grid, worldToCol(grid, x), worldToRow(grid, z));
    }

    // Shortest-path angle lerp so the mesh turns smoothly instead of snapping.
    private rotateTowards(targetAngle: number, dt: number) {
        let delta = targetAngle - this.mesh.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));

        const maxStep = this.turnSpeed * dt;
        if (Math.abs(delta) <= maxStep) {
            this.mesh.rotation.y = targetAngle;
        } else {
            this.mesh.rotation.y += Math.sign(delta) * maxStep;
        }
    }
}
