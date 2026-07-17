import * as THREE from "three";
import type { Experience } from "../Experience";
import { Environment } from "./Environment";
import { events } from "../../core/events";
import { stateMachine } from "../../core/StateMachine";
import { mapLayout } from "../../data/mapLayout";
import type { ItemEntity } from "../../data/MapEntity";
import type { Entity } from "../entities/Entity";
import { createMapEntity } from "../entities/entityFactories";
import { createPlayer } from "../entities/PlayerFactory";

const CAMERA_OFFSET = new THREE.Vector3(10, 10, 10);

export class World {
    private experience: Experience;
    private entities: Entity[] = [];
    public items: { entity: Entity; source: ItemEntity }[] = [];
    private entityGroup = new THREE.Group();
    private player: Entity;

    constructor(experience: Experience) {
        this.experience = experience;
        new Environment(this.experience);

        this.experience.scene.add(this.entityGroup);
        this.entityGroup.visible = stateMachine.getState() === 'GAME';

        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x5cb85c });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.entityGroup.add(ground);

        this.player = createPlayer(CAMERA_OFFSET);
        this.player.mesh.castShadow = true;
        this.entityGroup.add(this.player.mesh);

        events.on('stateChange', (newState) => {
            this.entityGroup.visible = newState === 'GAME';
        });

        this.entities = mapLayout.map(createMapEntity);
        for (const entity of this.entities) {
            this.entityGroup.add(entity.mesh);
        }

        for (const mapEntity of mapLayout) {
            if (mapEntity.kind !== 'item') continue;
            const entity = this.entities.find((e) => e.id === mapEntity.id);
            if (entity) this.items.push({ entity, source: mapEntity });
        }

        events.on('itemCollected', (item) => this.removeItem(item.id));
    }

    private removeItem(itemId: string) {
        const collected = this.items.find(({ source }) => source.id === itemId);
        if (!collected) return;

        this.entityGroup.remove(collected.entity.mesh);
        this.entities = this.entities.filter((e) => e !== collected.entity);
        this.items = this.items.filter(({ source }) => source.id !== itemId);
    }

    public update(dt: number) {
        for (const entity of this.entities) {
            entity.update(dt);
        }

        this.player.update(dt);

        const camera = this.experience.camera;
        camera.position.copy(this.player.mesh.position).add(CAMERA_OFFSET);
        camera.lookAt(this.player.mesh.position);
    }
}
