import * as THREE from "three";
import type { Experience } from "../Experience";
import { Environment } from "./Environment";
import { events } from "../../core/events";
import { mapLayout } from "../../data/mapLayout";
import type { ItemEntity } from "../../data/MapEntity";
import type { Entity } from "../entities/Entity";
import { createMapEntity } from "../entities/entityFactories";

export class World {
    private experience: Experience;
    private entities: Entity[] = [];
    public items: { entity: Entity; source: ItemEntity }[] = [];
    private entityGroup = new THREE.Group();

    constructor(experience: Experience) {
        this.experience = experience;
        new Environment(this.experience);

        this.experience.scene.add(this.entityGroup);
        this.entityGroup.visible = false;

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
    }
}
