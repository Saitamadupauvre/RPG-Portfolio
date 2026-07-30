import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { PathfindingComponent } from './PathfindingComponent';
import { DetectionComponent } from './DetectionComponent';
import { ComboComponent } from './ComboComponent';

const RETURN_ARRIVAL_RADIUS = 0.2;

// Orchestrates an enemy's chase/attack behavior: idles at its spawn origin, chases the
// player once DetectionComponent aggros, attacks via ComboComponent once in range, and
// walks back to origin once DetectionComponent deaggros. Owns its sub-components directly
// (rather than registering them on Entity too) so update order is explicit and predictable
// instead of depending on Map insertion order.
export class EnemyAIComponent implements Component {
    public readonly name = 'enemyAI';

    private mesh: THREE.Object3D;
    private player: THREE.Object3D;
    private origin: THREE.Vector3;
    private attackRange: number;

    private pathfinding: PathfindingComponent;
    private detection: DetectionComponent;
    private combo: ComboComponent;

    constructor(
        mesh: THREE.Object3D,
        player: THREE.Object3D,
        origin: THREE.Vector3,
        moveSpeed: number,
        aggroRadius: number,
        deaggroRadius: number,
        combo: ComboComponent,
        attackRange = 1.2,
    ) {
        this.mesh = mesh;
        this.player = player;
        this.origin = origin.clone();
        this.attackRange = attackRange;

        this.pathfinding = new PathfindingComponent(mesh, moveSpeed);
        this.detection = new DetectionComponent(mesh, player, this.origin, aggroRadius, deaggroRadius);
        this.combo = combo;
    }

    public setOrigin(origin: THREE.Vector3) {
        this.origin.copy(origin);
        this.detection.setOrigin(this.origin);
        this.pathfinding.clearTarget();
    }

    public update(dt: number) {
        this.detection.update();

        if (this.detection.isAggroed) {
            this.pursuePlayer();
        } else {
            this.returnToOrigin();
        }

        this.pathfinding.update(dt);
        this.combo.update(dt);
    }

    private pursuePlayer() {
        const distance = this.mesh.position.distanceTo(this.player.position);
        if (distance <= this.attackRange) {
            this.pathfinding.clearTarget();
            this.combo.trigger(this.player.position);
        } else {
            this.pathfinding.setTarget(this.player.position);
        }
    }

    private returnToOrigin() {
        if (this.mesh.position.distanceTo(this.origin) > RETURN_ARRIVAL_RADIUS) {
            this.pathfinding.setTarget(this.origin);
        } else {
            this.pathfinding.clearTarget();
        }
    }
}
