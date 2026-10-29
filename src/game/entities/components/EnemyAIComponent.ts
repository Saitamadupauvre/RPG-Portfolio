import * as THREE from 'three';
import { PathfindingComponent } from './PathfindingComponent';
import { DetectionComponent } from './DetectionComponent';
import type { EnemyAttacker } from './EnemyAttacker';
import type { EnemyBrain } from './EnemyBrain';

const RETURN_ARRIVAL_RADIUS = 0.2;

/** The hunter's brain: chases the player once they come near, attacks in reach, walks home when outrun. */
export class EnemyAIComponent implements EnemyBrain {
    public readonly name = 'enemyAI';

    private mesh: THREE.Object3D;
    private player: THREE.Object3D;
    private origin: THREE.Vector3;

    private pathfinding: PathfindingComponent;
    private detection: DetectionComponent;
    private attacker: EnemyAttacker;

    constructor(
        mesh: THREE.Object3D,
        player: THREE.Object3D,
        origin: THREE.Vector3,
        moveSpeed: number,
        aggroRadius: number,
        deaggroRadius: number,
        attacker: EnemyAttacker,
    ) {
        this.mesh = mesh;
        this.player = player;
        this.origin = origin.clone();

        this.pathfinding = new PathfindingComponent(mesh, moveSpeed);
        this.detection = new DetectionComponent(mesh, player, this.origin, aggroRadius, deaggroRadius);
        this.attacker = attacker;
    }

    public get isAggroed(): boolean {
        return this.detection.isAggroed;
    }

    /** Puts the enemy back to its just-spawned state around a (new) home point. */
    public reset(origin: THREE.Vector3) {
        this.origin.copy(origin);
        this.detection.setOrigin(this.origin);
        this.pathfinding.clearTarget();
        this.attacker.reset();
    }

    public update(dt: number) {
        this.detection.update();

        if (this.detection.isAggroed) {
            this.pursuePlayer();
        } else {
            this.returnToOrigin();
        }

        this.pathfinding.update(dt);
        this.attacker.update?.(dt);
    }

    private pursuePlayer() {
        const distance = this.mesh.position.distanceTo(this.player.position);
        if (this.attacker.engage(this.player.position, distance)) {
            this.pathfinding.clearTarget();
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
