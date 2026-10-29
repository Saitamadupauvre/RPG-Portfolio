import * as THREE from 'three';
import type { TriggerEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { TriggerComponent } from './components/TriggerComponent';
import { EDITOR_LAYER } from '../render/layers';
import { PALETTE } from '../render/palette';

const FILL_OPACITY = 0.18;

/**
 * An invisible volume that runs its action when the player walks in. Its meshes
 * sit on `EDITOR_LAYER`, which only the editor camera enables: in game the box
 * is skipped by the renderer, yet still updates and fires — `visible = false`
 * would hide it from the editor's picking too.
 */
export function createTrigger(entity: TriggerEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    // Unit box standing on the origin, so the entity's scale is its size and it grows upward.
    const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

    const fill = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: PALETTE.trigger, transparent: true, opacity: FILL_OPACITY, depthWrite: false }),
    );
    // The fill would catch every editor click aimed at what stands inside the box;
    // only the edges are pickable (within the raycaster's line threshold).
    fill.raycast = () => {};

    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: PALETTE.trigger }),
    );

    group.add(fill, edges);
    group.traverse((object) => object.layers.set(EDITOR_LAYER));

    return new Entity(entity.id, group).addComponent('trigger', new TriggerComponent(group, entity.action));
}
