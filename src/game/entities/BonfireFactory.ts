import * as THREE from 'three';
import type { BonfireEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { events } from '../../core/events';
import { setCheckpoint } from '../../domain/checkpoint';
import { GlowComponent } from './components/GlowComponent';
import { InteractableComponent } from './components/InteractableComponent';

const FLAME_COLOR = 0xff8822;
const INTERACT_RADIUS = 2.2;
const COLLISION_RADIUS = 0.5;

export function createBonfire(entity: BonfireEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x555a60 });
    const stones = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.25, 8), stoneMaterial);
    stones.position.y = 0.12;
    stones.castShadow = true;

    // Own material instance: the flame is what pulses, the stones must stay dark.
    const flameMaterial = new THREE.MeshStandardMaterial({ color: FLAME_COLOR });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), flameMaterial);
    flame.position.y = 0.6;

    group.add(stones, flame);

    // Bonfires glow permanently — the glow is a landmark, not a "not yet used" marker.
    const glow = new GlowComponent(flameMaterial, FLAME_COLOR);

    const interactable = new InteractableComponent(INTERACT_RADIUS, 'Rest at bonfire', () => {
        setCheckpoint(entity.position);
        events.emit('bonfireRested');
    });

    return new Entity(entity.id, group, COLLISION_RADIUS)
        .addComponent('glow', glow)
        .addComponent('interactable', interactable);
}
