import * as THREE from "three";
import type { Experience } from "../Experience";
import { Environment } from "./Environment";
import { events } from "../../core/events";
import { stateMachine } from "../../core/StateMachine";
import { mapLayout } from "../../data/mapLayout";
import type { ItemEntity, MapEntity } from "../../data/MapEntity";
import { getCheckpoint } from "../../domain/checkpoint";
import { HealthComponent } from "../../domain/components/HealthComponent";
import type { Entity } from "../entities/Entity";
import { createMapEntity } from "../entities/entityFactories";
import { createPlayer } from "../entities/PlayerFactory";
import { enemyPool } from "../entities/EnemyPool";
import { CombatSystem } from "../CombatSystem";
import { EntityCollisionSystem } from "../EntityCollisionSystem";
import { InteractionSystem } from "../InteractionSystem";
import { rebuildNavGrid } from "./navigation";

const CAMERA_OFFSET = new THREE.Vector3(6, 6, 6);
const GROUND_SIZE = 50;
// Matches the iris-wipe close duration in ui/views/IrisView.ts: the screen is fully black
// when the player is teleported, so the respawn never happens on camera.
const RESPAWN_DELAY_MS = 1200;

export class World {
    private experience: Experience;
    private entities: Entity[] = [];
    public items: { entity: Entity; source: ItemEntity }[] = [];
    public entityGroup = new THREE.Group();
    private combat: CombatSystem;
    private collision = new EntityCollisionSystem();
    private interaction = new InteractionSystem();
    private paused = false;
    public player: Entity;

    constructor(experience: Experience) {
        this.experience = experience;
        new Environment(this.experience);

        this.experience.scene.add(this.entityGroup);
        this.entityGroup.visible = this.isGameVisible(stateMachine.getState());

        const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
        const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x5cb85c });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.entityGroup.add(ground);

        this.player = createPlayer(CAMERA_OFFSET, this.entityGroup);
        this.player.mesh.castShadow = true;
        this.entityGroup.add(this.player.mesh);

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

        events.on('itemCollected', (item) => this.removeItem(item.id));
        events.on('pauseChanged', (paused) => { this.paused = paused; });
        events.on('bonfireRested', () => {
            this.player.getComponent<HealthComponent>('health')?.refill();
            this.combat.resetEnemies();
        });
    }

    // Swaps the whole level in one call: used at boot with mapLayout, and by the editor
    // every time a placement changes, so there's a single build path to keep correct.
    public loadLayout(layout: MapEntity[]) {
        for (const entity of this.entities) {
            this.entityGroup.remove(entity.mesh);
        }

        this.entities = [];
        this.items = [];
        this.combat.clear();
        rebuildNavGrid(layout);

        for (const mapEntity of layout) {
            const entity = createMapEntity(mapEntity);
            this.entities.push(entity);
            this.entityGroup.add(entity.mesh);

            if (mapEntity.kind === 'item') this.items.push({ entity, source: mapEntity });
            if (mapEntity.kind === 'enemy') this.combat.addEnemy(entity, mapEntity);
        }
    }

    public getEntities(): Entity[] {
        return this.entities;
    }

    // The world stays rendered while dead so the iris wipe closes over the death scene,
    // not over a blank screen — only simulation stops.
    private isGameVisible(state: string) {
        return state === 'GAME' || state === 'DEAD' || state === 'EDITOR';
    }

    private removeItem(itemId: string) {
        const collected = this.items.find(({ source }) => source.id === itemId);
        if (!collected) return;

        this.entityGroup.remove(collected.entity.mesh);
        this.entities = this.entities.filter((e) => e !== collected.entity);
        this.items = this.items.filter(({ source }) => source.id !== itemId);
    }

    public update(dt: number) {
        const camera = this.experience.camera;
        const state = stateMachine.getState();

        // Paused (book open), dead, or editing: freeze simulation. The editor drives its
        // own camera, so the follow-cam is skipped too.
        if (this.paused || state === 'DEAD' || state === 'EDITOR') return;

        for (const entity of this.entities) {
            entity.update(dt);
        }

        this.player.update(dt);
        this.collision.resolve([...this.entities, this.player]);
        this.interaction.update(this.entities, this.player.mesh.position);

        this.followPlayer(camera);
        this.combat.update(dt, camera);

        if (this.player.getComponent<HealthComponent>('health')?.isDead()) this.die(camera);
    }

    private followPlayer(camera: THREE.PerspectiveCamera) {
        camera.position.copy(this.player.mesh.position).add(CAMERA_OFFSET);
        camera.lookAt(this.player.mesh.position);
        camera.updateMatrixWorld();
    }

    // Called when leaving the editor: puts the camera back behind the player.
    public resetCamera() {
        this.followPlayer(this.experience.camera);
    }

    private die(camera: THREE.PerspectiveCamera) {
        stateMachine.changeState('DEAD');
        const [x, y] = this.toScreen(this.player.mesh.position, camera);
        events.emit('playerDied', x, y);

        window.setTimeout(() => this.respawn(camera), RESPAWN_DELAY_MS);
    }

    private respawn(camera: THREE.PerspectiveCamera) {
        // Only XZ comes from the checkpoint: bonfires sit on the ground (y = 0) while the
        // player capsule's origin is at its center height.
        const [checkpointX, , checkpointZ] = getCheckpoint();
        this.player.mesh.position.x = checkpointX;
        this.player.mesh.position.z = checkpointZ;
        this.player.getComponent<HealthComponent>('health')?.refill();
        this.combat.resetEnemies();

        // Camera must be moved before projecting, or the iris would open on the spot the
        // player died at instead of where they now stand.
        this.followPlayer(camera);
        stateMachine.changeState('GAME');

        const [x, y] = this.toScreen(this.player.mesh.position, camera);
        events.emit('playerRespawned', x, y);
    }

    // World point -> pixel coordinates. project() gives normalized device coords in -1..1,
    // which map to the viewport with the usual half-width scale and a flipped Y axis.
    private toScreen(position: THREE.Vector3, camera: THREE.PerspectiveCamera): [number, number] {
        const ndc = position.clone().project(camera);
        return [
            (ndc.x + 1) / 2 * window.innerWidth,
            (1 - ndc.y) / 2 * window.innerHeight,
        ];
    }
}
