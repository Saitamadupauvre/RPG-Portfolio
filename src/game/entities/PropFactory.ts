import * as THREE from 'three';
import type { PropEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { createToonMaterial } from '../render/toon';

export const PROP_BASE_HEIGHT = { collidable: 2, decor: 0.7 };
/** Footprint of the unscaled prop box in X and Z. Its collider is derived from this. */
export const PROP_BASE_FOOTPRINT = 1;

export function createProp(entity: PropEntity): Entity {
    const height = entity.collidable ? PROP_BASE_HEIGHT.collidable : PROP_BASE_HEIGHT.decor;
    const geometry = new THREE.BoxGeometry(PROP_BASE_FOOTPRINT, height, PROP_BASE_FOOTPRINT);
    const material = createToonMaterial({ color: entity.collidable ? 0x7c6f64 : 0xa89984 });
    const mesh = new THREE.Mesh(geometry, material);

    // Box geometry is centred on its origin, so it stands half its height up.
    applyTransform(mesh, entity, height / 2);

    // A box approximated by a circle, so take the inscribed radius (the smaller
    // half-extent): the collider then never bulges outside the mesh the player
    // can see. The cost is that a long wall's corners are walkable — long props
    // want a real box collider, which the circle-only collision system has no
    // notion of yet.
    const halfExtentX = (PROP_BASE_FOOTPRINT * (entity.scale?.[0] ?? 1)) / 2;
    const halfExtentZ = (PROP_BASE_FOOTPRINT * (entity.scale?.[2] ?? 1)) / 2;
    const collisionRadius = entity.collidable ? Math.min(halfExtentX, halfExtentZ) : undefined;

    return new Entity(entity.id, mesh, collisionRadius, true);
}
