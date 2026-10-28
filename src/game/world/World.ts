import * as THREE from "three";
import type { Experience } from "../Experience";
import { Environment } from "./Environment";
import { events } from "../../core/events";
import { stateMachine, type AppState } from "../../core/StateMachine";
import { setPaused } from "../../core/pause";
import { mapLayout } from "../../data/mapLayout";
import type { MapEntity } from "../../data/MapEntity";
import { getCheckpoint } from "../../domain/checkpoint";
import { loseAllCoins } from "../../domain/playerProgress";
import type { Entity } from "../entities/Entity";
import { createMapEntity } from "../entities/entityFactories";
import { createPlayer } from "../entities/PlayerFactory";
import { bindPlayerStats } from "../playerStats";
import { enemyPool } from "../entities/EnemyPool";
import { CombatSystem } from "../CombatSystem";
import { ProjectileSystem } from "../ProjectileSystem";
import { FireSystem } from "../FireSystem";
import { EntityCollisionSystem } from "../EntityCollisionSystem";
import { InteractionSystem } from "../InteractionSystem";
import { findFreePoint, rebuildNavGrid } from "./navigation";
import { rebuildObstacles } from "./obstacles";
import { ChunkStreamer } from "./ChunkStreamer";
import { chunkKeyAt, type ChunkKey } from "../../domain/chunks";
import { isBossDefeated } from "../../domain/defeatedBosses";
import { isEnemySlain } from '../../domain/slainEnemies';
import { GrassSurface, type GrassCollider } from "./grass/GrassSurface";
import { Terrain } from "./Terrain";
import { buildGrassFootprints } from "./grass/grassFootprints";
import { WindStreaks } from "./windStreaks";
import { Water } from "./water/Water";
import { tileMap, type TileMap } from "../../data/tileMap";
import { groundHeight, snapToGround } from "./terrainField";
import { aimMenuShot, CameraBlend, GAME_FOV, setFov } from "./menuShot";

const CAMERA_OFFSET = new THREE.Vector3(6, 6, 6);
/** Keeps the camera from burying itself in a hill or cliff behind the player. */
const CAMERA_CLEARANCE = 2;
/** The way the camera faces, flattened onto the ground: back along its offset. */
const GROUND_VIEW_DIR = new THREE.Vector3(-CAMERA_OFFSET.x, 0, -CAMERA_OFFSET.z).normalize();

/**
 * Where the camera stands to frame `target`. The offset alone would sink it
 * into rising ground behind the player; lifting it to clear the terrain under
 * it is cheaper than a raycast and enough for a fixed isometric view. Whatever
 * still hides a character is handled by its x-ray silhouette, not the camera.
 */
function cameraEye(target: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(target).add(CAMERA_OFFSET);
    out.y = Math.max(out.y, groundHeight(out.x, out.z) + CAMERA_CLEARANCE);
    return out;
}

/**
 * How much wider than its body a mover parts the grass. At exactly the
 * collision radius the parted ring hides under the body itself and barely shows.
 */
const GRASS_PUSH_SCALE = 1.8;

export class World {
    private experience: Experience;
    private environment: Environment;
    /** Live entities per loaded chunk — the authority on what exists. */
    private loaded = new Map<ChunkKey, Entity[]>();
    /**
     * Flat view of `loaded`, rebuilt only when the chunk set changes. Every
     * per-frame loop reads this, so flattening the Map each frame would trade
     * the cost we just saved right back.
     */
    private entities: Entity[] = [];
    /** Reused every frame for collision so update() allocates no array. */
    private allBodies: Entity[] = [];
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
    /** Between `restRequested` and `restCovered`: the world is held paused under the closing iris. */
    private resting = false;
    /** `playerFaded` went out for this death. */
    private deathReported = false;
    private cameraBlend = new CameraBlend();
    /** Reused every menu frame: where the knight's feet are. */
    private menuFeet = new THREE.Vector3();
    // One full-ratio tier: Terrain already grows far patches sparser, and a draw
    // LOD on top would thin them a second time.
    public readonly grass = new GrassSurface({ lod: [{ distance: Infinity, ratio: 1 }] });
    private grassColliders: GrassCollider[] = [];
    public terrain: Terrain;
    public water: Water;
    public readonly windStreaks: WindStreaks;
    public player: Entity;

    constructor(experience: Experience) {
        this.experience = experience;
        this.environment = new Environment(this.experience);

        this.experience.scene.add(this.entityGroup);
        this.entityGroup.visible = this.isGameVisible(stateMachine.getState());

        this.terrain = new Terrain(tileMap, this.grass);
        this.entityGroup.add(this.terrain.mesh);

        // In the entity group rather than the scene, so it hides with the rest of
        // the world when the game is not the visible state.
        this.water = new Water(tileMap.waterLevel ?? 0);
        this.entityGroup.add(this.water.mesh);

        // Read at spawn time, not now: the editor can move the sea level.
        this.windStreaks = new WindStreaks((x, z) => Math.max(groundHeight(x, z), this.water.getLevel()));
        this.entityGroup.add(this.windStreaks.mesh);

        this.player = createPlayer(CAMERA_OFFSET, this.entityGroup);
        this.player.mesh.castShadow = true;
        this.entityGroup.add(this.player.mesh);
        bindPlayerStats(this.player);

        // Shared by the archers and dragons that loose arrows and flames, and the combat system that lands them.
        const projectiles = new ProjectileSystem(this.entityGroup);
        const fire = new FireSystem(this.entityGroup);
        enemyPool.init(this.experience.camera, this.player.mesh, this.entityGroup, projectiles, fire);

        this.combat = new CombatSystem(
            this.entityGroup,
            this.player,
            projectiles,
            fire,
            (entity) => {
                // CombatSystem owns the body now (it fades, then goes back to the pool);
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

        events.on('stateChange', (newState, oldState) => {
            this.entityGroup.visible = this.isGameVisible(newState);

            // Into the menu or out of it, the camera glides between the two shots instead of cutting.
            const menuCut = (oldState === 'MENU' && newState === 'GAME') || (oldState === 'GAME' && newState === 'MENU');
            if (menuCut) this.cameraBlend.start(this.experience.camera);
            // Quit mid-run: the knight must not keep running on the menu backdrop.
            if (newState === 'MENU') this.stopPlayerInput();
        });

        this.loadLayout(mapLayout);

        events.on('pauseChanged', (paused) => {
            this.paused = paused;

            if (paused) this.stopPlayerInput();
        });
        // Resting is a handshake like dying: the screen goes black first, so
        // enemies reset where nobody can see them pop back.
        events.on('restRequested', () => this.startRest());
        events.on('restCovered', () => this.finishRest());
        // The death screen decides when the player may be moved: once it hides the world.
        events.on('respawnRequested', () => this.respawn(this.experience.camera));

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
        this.refreshFootprints(layout);
        this.streamer.setLayout(layout);

        this.streamFor(this.player.mesh.position);
    }

    /**
     * Everything derived from where static objects stand, without respawning
     * them: an editor drag moves the meshes itself, only these lag behind.
     */
    public refreshFootprints(layout: MapEntity[]) {
        rebuildNavGrid(layout);
        rebuildObstacles(layout);
        // Same reasoning: from the whole layout, so a patch grown before its
        // chunk's entities stream in is still bare under them.
        this.terrain.setGrassFootprints(buildGrassFootprints(layout));
    }

    /** Loads/unloads the chunks around a position and refreshes the flat view. */
    private streamFor(position: THREE.Vector3): boolean {
        const changed = this.streamer.update(position.x, position.z);
        if (changed) this.entities = [...this.loaded.values()].flat();

        return changed;
    }

    private spawnEntity(mapEntity: MapEntity, key: ChunkKey) {
        // A boss is a one-time fight: a recorded kill keeps it from respawning.
        if (mapEntity.kind === 'enemy' && mapEntity.enemyType === 'boss' && isBossDefeated(mapEntity.id)) return;
        // A regular enemy killed since the last rest or death stays dead, however often its chunk reloads.
        if (mapEntity.kind === 'enemy' && isEnemySlain(mapEntity.id)) {
            this.combat.addSlain(mapEntity);
            return;
        }

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

        this.combat.forgetChunk(key);
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

    /** The menu too: the world stands behind it as its backdrop. */
    private isGameVisible(state: AppState) {
        return state === 'MENU' || state === 'GAME' || state === 'DEAD' || state === 'EDITOR';
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
        this.windStreaks.update(this.experience.timer.getElapsed(), this.player.mesh.position);
        this.environment.followShadows(this.player.mesh.position);

        if (state === 'DEAD') this.updateDeath(dt);
        if (state === 'MENU') {
            this.updateMenu(dt);
            return;
        }

        // Not only DEAD and EDITOR: quitting to the menu leaves the world loaded, and it must not play on unseen.
        if (this.paused || state !== 'GAME') return;

        for (const entity of this.entities) {
            entity.update(dt);
        }

        this.player.update(dt);
        this.streamFor(this.player.mesh.position);
        this.allBodies.length = 0;
        this.allBodies.push(...this.entities, this.player);
        this.collision.resolve(this.allBodies);
        this.seatOnTerrain();
        this.updateTriggers();
        this.interaction.update(this.entities, this.player.mesh.position);

        this.followPlayer(camera);
        this.cameraBlend.apply(camera, dt);
        camera.updateMatrixWorld();
        this.updateGhosts(camera);
        this.combat.update(dt, camera);

        if (this.player.getComponent('health')?.isDead()) this.die();
    }

    /**
     * Rides every mover on the terrain surface. Done centrally, after movement
     * and collision have settled x/z, rather than inside each component: a hard
     * snap is exact, cannot fall through the world, and needs no gravity — and
     * one loop here beats threading a ground offset through movement, dash,
     * pathfinding and the AI. Movers only: static entities were seated once by
     * their factory, and snapping them here would erase an authored heightOffset.
     */
    private seatOnTerrain() {
        for (const entity of this.entities) {
            if (entity.getComponent('enemyAI')) snapToGround(entity.mesh, entity.groundOffset);
        }

        const airborne = this.player.getComponent('dash')?.airborneHeight() ?? null;
        if (airborne === null) snapToGround(this.player.mesh, this.player.groundOffset);
        else this.player.mesh.position.y = airborne + this.player.groundOffset;
    }

    /** After seating: the player's height is final for this frame, so a box raised off the ground tests right. */
    private updateTriggers() {
        for (const entity of this.entities) {
            entity.getComponent('trigger')?.test(this.player.mesh.position);
        }
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
            this.grassColliders.push({ position: entity.mesh.position, radius: entity.collisionRadius * GRASS_PUSH_SCALE });
        }
        if (this.player.collisionRadius !== undefined) {
            this.grassColliders.push({ position: this.player.mesh.position, radius: this.player.collisionRadius * GRASS_PUSH_SCALE });
        }

        // Grass exists only in a ring around the player, so the ring has to
        // follow them before the surface is asked to draw it.
        // The camera always frames the player, so the player is the focus.
        const { x, z } = this.player.mesh.position;
        this.terrain.updateGrass({ x, z, dirX: GROUND_VIEW_DIR.x, dirZ: GROUND_VIEW_DIR.z });
        this.grass.update(this.experience.timer.getElapsed(), camera, this.grassColliders);
    }

    /** Props the camera stands inside turn see-through; after followPlayer, so the test uses this frame's eye. */
    private updateGhosts(camera: THREE.PerspectiveCamera) {
        for (const entity of this.entities) {
            const ghost = entity.getComponent('ghost');
            ghost?.setGhosted(ghost.contains(camera.position));
        }
    }

    private stopPlayerInput() {
        this.player.getComponent('movement')?.clearInput();
        this.player.getComponent('dash')?.cancel();
    }

    private followPlayer(camera: THREE.PerspectiveCamera) {
        cameraEye(this.player.mesh.position, camera.position);
        camera.lookAt(this.player.mesh.position);
        setFov(camera, GAME_FOV);
        camera.updateMatrixWorld();
    }

    /**
     * The menu backdrop: the world stays still (no AI, no combat), only the
     * idle animations play and the camera drifts round the knight. Updating
     * the player whole is safe here: its input listeners only listen in GAME.
     */
    private updateMenu(dt: number) {
        const camera = this.experience.camera;

        this.player.update(dt);
        for (const entity of this.entities) {
            entity.getComponent('animator')?.update(dt);
        }

        const feet = this.menuFeet.copy(this.player.mesh.position);
        feet.y -= this.player.groundOffset;
        aimMenuShot(camera, feet, this.player.mesh.rotation.y, this.experience.timer.getElapsed());
        this.cameraBlend.apply(camera, dt);
        camera.updateMatrixWorld();
        this.updateGhosts(camera);
    }

    public resetCamera() {
        this.followPlayer(this.experience.camera);
    }

    /** Call once the world is on screen after leaving the menu: the transition opens on the player. */
    public reveal() {
        const [x, y] = this.playerOnScreen(this.experience.camera);
        events.emit('gameEntered', x, y);
    }

    public setShadows(enabled: boolean) {
        this.environment.setShadows(enabled);
    }

    private die() {
        stateMachine.changeState('DEAD');
        this.stopPlayerInput();
        // Before the fade reads the materials, so it starts from their real colours.
        this.player.getComponent('hitFlash')?.reset();
        this.player.getComponent('deathFade')?.start();
        this.deathReported = false;
        events.emit('playerDied', loseAllCoins());
    }

    /** The world stands still while dead; only the player's body whitens and fades, then the screen may close on it. */
    private updateDeath(dt: number) {
        const fade = this.player.getComponent('deathFade');
        fade?.update(dt);
        if (this.deathReported || fade?.done === false) return;

        this.deathReported = true;
        const [x, y] = this.playerOnScreen(this.experience.camera);
        events.emit('playerFaded', x, y);
    }

    private respawn(camera: THREE.PerspectiveCamera) {
        if (stateMachine.getState() !== 'DEAD') return;

        this.placeAtCheckpoint(camera);
        this.restore();
        stateMachine.changeState('GAME');

        const [x, y] = this.playerOnScreen(camera);
        events.emit('playerRespawned', x, y);
    }

    /**
     * Freezes the world (same pause as the book: enemies and arrows stop, the
     * player's input drops) while the screen closes onto the player.
     */
    private startRest() {
        if (this.resting || stateMachine.getState() !== 'GAME') return;

        this.resting = true;
        setPaused('rest', true);
        // The circle closes onto the player: "Rest at bonfire" must not sit inside it.
        this.interaction.hidePrompt();
        const [x, y] = this.playerOnScreen(this.experience.camera);
        events.emit('restStarted', x, y);
    }

    private finishRest() {
        if (!this.resting) return;

        this.resting = false;
        this.restore();
        setPaused('rest', false);
        // Left for the menu under the black screen: nothing to open onto.
        if (stateMachine.getState() !== 'GAME') return;

        const [x, y] = this.playerOnScreen(this.experience.camera);
        events.emit('playerRested', x, y);
    }

    /** What a respawn and a rest share: full health, standing still, every non-boss enemy back home. */
    private restore() {
        this.player.getComponent('health')?.refill();
        this.player.getComponent('deathFade')?.reset();
        // Died (or sat down) mid-swing: come back standing, not finishing the blow.
        this.player.getComponent('combo')?.reset();
        this.player.getComponent('animationDriver')?.reset();
        this.combat.resetEnemies();
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

    /** The middle of the player's body, not their feet: what a transition circle should frame. */
    private playerOnScreen(camera: THREE.PerspectiveCamera): [number, number] {
        const ndc = this.player.mesh.position.clone();
        ndc.y += (this.player.bodyHeight ?? 0) / 2 - this.player.groundOffset;
        ndc.project(camera);
        return [
            (ndc.x + 1) / 2 * window.innerWidth,
            (1 - ndc.y) / 2 * window.innerHeight,
        ];
    }
}
