import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { findPath } from '../../../domain/pathfinding/AStar';
import { getNavGrid } from '../../world/navigation';

const REPATH_INTERVAL = 0.4;
const WAYPOINT_RADIUS = 0.15;

// Steers a mesh toward a target position via A* over the shared static nav grid.
// Re-plans periodically rather than every frame since the target (usually the player) keeps moving.
export class PathfindingComponent implements Component {
    public readonly name = 'pathfinding';

    private mesh: THREE.Object3D;
    private speed: number;
    private turnSpeed: number;

    private target: THREE.Vector3 | null = null;
    private path: THREE.Vector3[] = [];
    private waypointIndex = 0;
    private repathTimer = 0;

    constructor(mesh: THREE.Object3D, speed: number, turnSpeed = Math.PI * 6) {
        this.mesh = mesh;
        this.speed = speed;
        this.turnSpeed = turnSpeed;
    }

    // Safe to call every frame with a moving target (e.g. the player): only forces an
    // immediate repath the first time a chase starts, otherwise just updates where the
    // existing path is heading and lets the periodic REPATH_INTERVAL handle replanning.
    public setTarget(target: THREE.Vector3) {
        if (!this.target) {
            this.target = target.clone();
            this.repathTimer = 0;
        } else {
            this.target.copy(target);
        }
    }

    public clearTarget() {
        this.target = null;
        this.path = [];
        this.waypointIndex = 0;
    }

    public get hasTarget(): boolean {
        return this.target !== null;
    }

    public get hasArrived(): boolean {
        return this.target !== null && this.waypointIndex >= this.path.length;
    }

    public update(dt: number) {
        if (!this.target) return;

        this.repathTimer -= dt;
        if (this.repathTimer <= 0) {
            this.repath();
            this.repathTimer = REPATH_INTERVAL;
        }

        this.followPath(dt);
    }

    private repath() {
        if (!this.target) return;

        const grid = getNavGrid();
        const found = findPath(grid, [this.mesh.position.x, this.mesh.position.z], [this.target.x, this.target.z]);
        this.path = found ? found.map(([x, z]) => new THREE.Vector3(x, this.mesh.position.y, z)) : [];
        this.waypointIndex = 0;
    }

    private followPath(dt: number) {
        if (this.waypointIndex >= this.path.length) return;

        const waypoint = this.path[this.waypointIndex];
        const toWaypoint = new THREE.Vector3().subVectors(waypoint, this.mesh.position).setY(0);
        const distance = toWaypoint.length();

        if (distance < WAYPOINT_RADIUS) {
            this.waypointIndex++;
            return;
        }

        toWaypoint.normalize();
        this.mesh.position.addScaledVector(toWaypoint, this.speed * dt);
        this.rotateTowards(Math.atan2(toWaypoint.x, toWaypoint.z), dt);
    }

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
