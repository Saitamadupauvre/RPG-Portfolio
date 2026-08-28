import * as THREE from "three";
import type { Experience } from "../Experience";
import { Environment } from "./Environment";
import { events } from "../../core/events";
import { stateMachine, type AppState } from "../../core/StateMachine";
import { mapLayout } from "../../data/mapLayout";
import type { MapEntity } from "../../data/MapEntity";
import { getCheckpoint } from "../../domain/checkpoint";
import type { Entity } from "../entities/Entity";
import { createMapEntity } from "../entities/entityFactories";
import { createPlayer } from "../entities/PlayerFactory";
import { bindPlayerStats } from "../playerStats";
import { enemyPool } from "../entities/EnemyPool";
import { CombatSystem } from "../CombatSystem";
import { EntityCollisionSystem } from "../EntityCollisionSystem";
import { InteractionSystem } from "../InteractionSystem";
import { rebuildNavGrid } from "./navigation";
import { GrassSurface, type GrassCollider } from "./grass/GrassSurface";
import { createGroundMaterial } from "./grass/groundMaterial";

const CAMERA_OFFSET = new THREE.Vector3(6, 6, 6);
const GROUND_SIZE = 50;

const RESPAWN_DELAY_MS = 1200;

export class World {
    private experience: Experience;
    private entities: Entity[] = [];
    public entityGroup = new THREE.Group();
    private combat: CombatSystem;
    private collision = new EntityCollisionSystem();
    private interaction = new InteractionSystem();
    private paused = false;
    private grass = new GrassSurface();
    private grassColliders: GrassCollider[] = [];
    public player: Entity;

    constructor(experience: Experience) {
        this.experience = experience;
        new Environment(this.experience);

        this.experience.scene.add(this.entityGroup);
        this.entityGroup.visible = this.isGameVisible(stateMachine.getState());

        const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
        const groundMaterial = createGroundMaterial();
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.entityGroup.add(ground);
        this.grass.attach(ground, { density: 90, chunkSize: 4 });

        this.player = createPlayer(CAMERA_OFFSET, this.entityGroup);
        this.player.mesh.castShadow = true;
        this.entityGroup.add(this.player.mesh);
        bindPlayerStats(this.player);

        enemyPool.init(this.experience.camera, this.player.mesh, this.entityGroup);

        this.combat = new CombatSystem(
            this.entityGroup,
            this.player,
            (entity) => {
                this.entities = this.entities.filter((e) => e !== entity);
            },
            (entity) => {
                this.entities.push(entity);
            },
        );

        events.on('stateChange', (newState) => {
            this.entityGroup.visible = this.isGameVisible(newState);
        });

        this.loadLayout(mapLayout);

        events.on('pauseChanged', (paused) => {
            this.paused = paused;

            if (paused) this.stopPlayerInput();
        });
        events.on('bonfireRested', () => {
            this.player.getComponent('health')?.refill();
            this.combat.resetEnemies();
        });
    }

    public loadLayout(layout: MapEntity[]) {
        for (const entity of this.entities) {
            this.entityGroup.remove(entity.mesh);
            entity.dispose();
        }

        this.entities = [];
        this.combat.clear();
        rebuildNavGrid(layout);

        for (const mapEntity of layout) {
            const entity = createMapEntity(mapEntity);
            this.entities.push(entity);
            this.entityGroup.add(entity.mesh);

            if (mapEntity.kind === 'enemy') this.combat.addEnemy(entity, mapEntity);
        }
    }

    public getEntities(): Entity[] {
        return this.entities;
    }

    private isGameVisible(state: AppState) {
        return state === 'GAME' || state === 'DEAD' || state === 'EDITOR';
    }

    public update(dt: number) {
        const camera = this.experience.camera;
        const state = stateMachine.getState();

        // Before the early return, so wind keeps blowing while paused, dead or
        // in the editor rather than freezing mid-sway.
        this.updateGrass(camera);

        if (this.paused || state === 'DEAD' || state === 'EDITOR') return;

        for (const entity of this.entities) {
            entity.update(dt);
        }

        this.player.update(dt);
        this.collision.resolve([...this.entities, this.player]);
        this.interaction.update(this.entities, this.player.mesh.position);

        this.followPlayer(camera);
        this.combat.update(dt, camera);

        if (this.player.getComponent('health')?.isDead()) this.die(camera);
    }

    private updateGrass(camera: THREE.PerspectiveCamera) {
        // Chunk culling reads matrixWorldInverse, which only the renderer
        // refreshes — without this the frustum test lags a frame behind.
        camera.updateMatrixWorld();

        this.grassColliders.length = 0;
        for (const entity of [...this.entities, this.player]) {
            // collisionRadius is optional on Entity; props without one flatten nothing.
            if (entity.collisionRadius === undefined) continue;
            this.grassColliders.push({ position: entity.mesh.position, radius: entity.collisionRadius });
        }

        this.grass.update(this.experience.timer.getElapsed(), camera, this.grassColliders);
    }

    private stopPlayerInput() {
        this.player.getComponent('movement')?.clearInput();
        this.player.getComponent('dash')?.cancel();
    }

    private followPlayer(camera: THREE.PerspectiveCamera) {
        camera.position.copy(this.player.mesh.position).add(CAMERA_OFFSET);
        camera.lookAt(this.player.mesh.position);
        camera.updateMatrixWorld();
    }

    public resetCamera() {
        this.followPlayer(this.experience.camera);
    }

    private die(camera: THREE.PerspectiveCamera) {
        stateMachine.changeState('DEAD');
        this.stopPlayerInput();
        const [x, y] = this.toScreen(this.player.mesh.position, camera);
        events.emit('playerDied', x, y);

        window.setTimeout(() => this.respawn(camera), RESPAWN_DELAY_MS);
    }

    private respawn(camera: THREE.PerspectiveCamera) {
        if (stateMachine.getState() !== 'DEAD') return;

        const [checkpointX, , checkpointZ] = getCheckpoint();
        this.player.mesh.position.x = checkpointX;
        this.player.mesh.position.z = checkpointZ;
        this.player.getComponent('health')?.refill();
        this.combat.resetEnemies();

        this.followPlayer(camera);
        stateMachine.changeState('GAME');

        const [x, y] = this.toScreen(this.player.mesh.position, camera);
        events.emit('playerRespawned', x, y);
    }

    private toScreen(position: THREE.Vector3, camera: THREE.PerspectiveCamera): [number, number] {
        const ndc = position.clone().project(camera);
        return [
            (ndc.x + 1) / 2 * window.innerWidth,
            (1 - ndc.y) / 2 * window.innerHeight,
        ];
    }
}
