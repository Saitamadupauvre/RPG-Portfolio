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
import { findFreePoint, rebuildNavGrid } from "./navigation";
import { ChunkStreamer } from "./ChunkStreamer";
import { chunkKeyAt, type ChunkKey } from "../../domain/chunks";
import { isBossDefeated } from "../../domain/defeatedBosses";
import { GrassSurface, type GrassCollider } from "./grass/GrassSurface";
import { Terrain } from "./Terrain";
import { Water } from "./water/Water";
import { tileMap, type TileMap } from "../../data/tileMap";
import { groundHeight, snapToGround } from "./terrainField";

const CAMERA_OFFSET = new THREE.Vector3(6, 6, 6);
/** Keeps the camera from burying itself in a hill or cliff behind the player. */
const CAMERA_CLEARANCE = 2;

const RESPAWN_DELAY_MS = 1200;

export class World {
    private experience: Experience;
    /** Live entities per loaded chunk â€” the authority on what exists. */
    private loaded = new Map<ChunkKey, Entity[]>();
    /**
     * Flat view of `loaded`, rebuilt only when the chunk set changes. Every
     * per-frame loop reads this, so flattening the Map each frame would trade
     * the cost we just saved right back.
     */
    private entities: Entity[] = [];
    private streamer: ChunkStreamer;
    /**
     * The chunk an entity was spawned into. Enemies wander, so their live
     * position is not a reliable way back to their bucket.
     */
    private chunkOf = new WeakMap<Entity, ChunkKey>();
    public entityGroup = new THREE.Group();
    private combat: CombatSystem;
    private collision = new EntityCollisionSystem();
    private interaction = new InteractionSystem();
    private paused = false;
    private grass = new GrassSurface();
    private grassColliders: GrassCollider[] = [];
    public terrain: Terrain;
    public water: Water;
    public player: Entity;

    constructor(experience: Experience) {
        this.experience = experience;
        new Environment(this.experience);

        this.experience.scene.add(this.entityGroup);
        this.entityGroup.visible = this.isGameVisible(stateMachine.getState());

        this.terrain = new Terrain(tileMap, this.grass);
        this.entityGroup.add(this.terrain.mesh);

        // In the entity group rather than the scene, so it hides with the rest of
        // the world when the game is not the visible state.
        this.water = new Water(tileMap.waterLevel ?? 0);
        this.entityGroup.add(this.water.mesh);

        this.player = createPlayer(CAMERA_OFFSET, this.entityGroup);
        this.player.mesh.castShadow = true;
        this.entityGroup.add(this.player.mesh);
        bindPlayerStats(this.player);

        enemyPool.init(this.experience.camera, this.player.mesh, this.entityGroup);

        this.combat = new CombatSystem(
            this.entityGroup,
            this.player,
            (entity) => {
                // CombatSystem already detached the mesh and pooled the entity;
                // the chunk must forget it too or the next despawn releases it twice.
                this.forgetEntity(entity);
                this.entities = this.entities.filter((e) => e !== entity);
            },
            (entity) => {
                this.trackEntity(entity, this.chunkKeyOf(entity));
                this.entities.push(entity);
            },
        );

        this.streamer = new ChunkStreamer(
            (mapEntity, key) => this.spawnEntity(mapEntity, key),
            (key) => this.despawnChunk(key),
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

        // After loadLayout: findFreePoint reads the nav grid, which only exists
        // once the layout has been rebuilt.
        this.placeAtCheckpoint(this.experience.camera);
    }

    public loadLayout(layout: MapEntity[]) {
        for (const key of [...this.loaded.keys()]) {
            this.despawnChunk(key);
        }

        this.combat.clear();
        this.streamer.clear();
        // Built from the *whole* layout, not the loaded chunks: a flat boolean
        // array costs nothing per frame, and an enemy pathing towards a wall in
        // an unloaded chunk still gets the right answer.
        rebuildNavGrid(layout);
        this.streamer.setLayout(layout);

        this.streamFor(this.player.mesh.position);
    }

    /** Loads/unloads the chunks around a position and refreshes the flat view. */
    private streamFor(position: THREE.Vector3): boolean {
        const changed = this.streamer.update(position.x, position.z);
        if (changed) this.entities = [...this.loaded.values()].flat();

        return changed;
    }

    private spawnEntity(mapEntity: MapEntity, key: ChunkKey) {
        // Regular enemies are meant to come back when their chunk reloads; a
        // boss is a one-time fight, so a recorded kill keeps it from respawning.
        if (mapEntity.kind === 'enemy' && mapEntity.enemyType === 'boss' && isBossDefeated(mapEntity.id)) return;

        const entity = createMapEntity(mapEntity);
        this.trackEntity(entity, key);
        this.entityGroup.add(entity.mesh);

        if (mapEntity.kind === 'enemy') this.combat.addEnemy(entity, mapEntity);
    }

    private despawnChunk(key: ChunkKey) {
        for (const entity of this.loaded.get(key) ?? []) {
            this.entityGroup.remove(entity.mesh);
            this.combat.removeEnemy(entity);
            // Pooled enemies go back to the pool through their disposer; anything
            // else frees its geometry and materials here.
            entity.dispose();
        }

        this.loaded.delete(key);
    }

    private trackEntity(entity: Entity, key: ChunkKey) {
        this.chunkOf.set(entity, key);
        const bucket = this.loaded.get(key);

        if (bucket) bucket.push(entity);
        else this.loaded.set(key, [entity]);
    }

    private forgetEntity(entity: Entity) {
        const key = this.chunkOf.get(entity);
        const bucket = key === undefined ? undefined : this.loaded.get(key);
        const index = bucket?.indexOf(entity) ?? -1;

        if (bucket && index !== -1) bucket.splice(index, 1);
    }

    private chunkKeyOf(entity: Entity): ChunkKey {
        return chunkKeyAt(entity.mesh.position.x, entity.mesh.position.z);
    }

    /**
     * The single entry point for a terrain change. Terrain and water are two
     * views of the same heightfield, so letting a caller rebuild one without the
     * other leaves the coastline drawn against the previous shape.
     */
    public rebuildTerrain(map: TileMap) {
        this.terrain.rebuild(map);
        this.water.setLevel(map.waterLevel ?? this.water.getLevel());
        this.water.onTerrainChanged();
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

        // Before the early return, so wind keeps blowing while paused, dead or in
        // the editor rather than freezing mid-sway.
        this.updateGrass(camera);
        // Same reasoning: the sea should keep moving while paused, dead or being
        // sculpted, instead of freezing mid-swell.
        this.water.update(this.experience.timer.getElapsed(), this.player.mesh.position);

        if (this.paused || state === 'DEAD' || state === 'EDITOR') return;

        for (const entity of this.entities) {
            entity.update(dt);
        }

        this.player.update(dt);
        this.streamFor(this.player.mesh.position);
        const allBodies = this.entities.concat(this.player);
        this.collision.resolve(allBodies);
        this.seatOnTerrain();
        this.interaction.update(this.entities, this.player.mesh.position);

        this.followPlayer(camera);
        this.combat.update(dt, camera);

        if (this.player.getComponent('health')?.isDead()) this.die(camera);
    }

    /**
     * Rides every mover on the terrain surface. Done centrally, after movement
     * and collision have settled x/z, rather than inside each component: a hard
     * snap is exact, cannot fall through the world, and needs no gravity — and
     * one loop here beats threading a ground offset through movement, dash,
     * pathfinding and the AI.
     */
    private seatOnTerrain() {
        for (const entity of this.entities) {
            snapToGround(entity.mesh, entity.groundOffset);
        }

        snapToGround(this.player.mesh, this.player.groundOffset);
    }

    private updateGrass(camera: THREE.PerspectiveCamera) {
        // Chunk culling reads matrixWorldInverse, which only the renderer
        // refreshes — without this the frustum test lags a frame behind.
        camera.updateMatrixWorld();

        this.grassColliders.length = 0;
        for (const entity of this.entities) {
            // Only dynamic moving entities (enemies, player) part the grass as they walk.
            // Static props, walls, and structures are excluded to avoid stretching grass around wide obstacles.
            if (entity.collisionRadius === undefined || entity.isStatic) continue;
            this.grassColliders.push({ position: entity.mesh.position, radius: entity.collisionRadius });
        }
        if (this.player.collisionRadius !== undefined) {
            this.grassColliders.push({ position: this.player.mesh.position, radius: this.player.collisionRadius });
        }

        this.grass.update(this.experience.timer.getElapsed(), camera, this.grassColliders);
    }

    private stopPlayerInput() {
        this.player.getComponent('movement')?.clearInput();
        this.player.getComponent('dash')?.cancel();
    }

    private followPlayer(camera: THREE.PerspectiveCamera) {
        camera.position.copy(this.player.mesh.position).add(CAMERA_OFFSET);
        // The offset alone would sink the camera into rising ground behind the
        // player; lifting it to clear the terrain under it is cheaper than a
        // raycast and enough for a fixed isometric view.
        camera.position.y = Math.max(
            camera.position.y,
            groundHeight(camera.position.x, camera.position.z) + CAMERA_CLEARANCE,
        );
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

        this.placeAtCheckpoint(camera);
        this.player.getComponent('health')?.refill();
        this.combat.resetEnemies();

        stateMachine.changeState('GAME');

        const [x, y] = this.toScreen(this.player.mesh.position, camera);
        events.emit('playerRespawned', x, y);
    }

    /** Drop the player on the last rested bonfire and snap the camera to them. */
    private placeAtCheckpoint(camera: THREE.PerspectiveCamera) {
        const [checkpointX, , checkpointZ] = getCheckpoint();
        const [spawnX, spawnZ] = findFreePoint(checkpointX, checkpointZ);

        this.player.mesh.position.x = spawnX;
        this.player.mesh.position.z = spawnZ;
        snapToGround(this.player.mesh, this.player.groundOffset);
        // Before the next frame reads the entity list: respawning at a distant
        // bonfire must load its chunks, not drop the player into an empty world.
        this.streamFor(this.player.mesh.position);

        this.followPlayer(camera);
    }

    private toScreen(position: THREE.Vector3, camera: THREE.PerspectiveCamera): [number, number] {
        const ndc = position.clone().project(camera);
        return [
            (ndc.x + 1) / 2 * window.innerWidth,
            (1 - ndc.y) / 2 * window.innerHeight,
        ];
    }
}
