import * as THREE from 'three';
import type { BonfireEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { events } from '../../core/events';
import { setCheckpoint } from '../../domain/checkpoint';
import { GlowComponent } from './components/GlowComponent';
import { InteractableComponent } from './components/InteractableComponent';
import { createToonMaterial } from '../render/toon';

const FLAME_COLOR = 0xff8822;
const INTERACT_RADIUS = 2.2;
const COLLISION_RADIUS = 0.5;

export function createBonfire(entity: BonfireEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const stoneMaterial = createToonMaterial({ color: 0x6b7280 });
    const stones = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.25, 8), stoneMaterial);
    stones.position.y = 0.12;
    stones.castShadow = true;

    const flameMaterial = createToonMaterial({ color: FLAME_COLOR, emissive: FLAME_COLOR, emissiveIntensity: 0.9 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), flameMaterial);
    flame.position.y = 0.6;

    group.add(stones, flame);

    const glow = new GlowComponent(flameMaterial, FLAME_COLOR);

    const interactable = new InteractableComponent(INTERACT_RADIUS, [
        {
            key: 'KeyE',
            label: 'Rest at bonfire',
            run: () => {
                setCheckpoint(entity.position);
                events.emit('bonfireRested');
            },
        },
        {
            key: 'KeyF',
            label: 'Level up board',
            run: () => events.emit('upgradeBoardRequested'),
        },
    ]);

    return new Entity(entity.id, group, COLLISION_RADIUS, true)
        .addComponent('glow', glow)
        .addComponent('interactable', interactable);
}
