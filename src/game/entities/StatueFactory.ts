import * as THREE from 'three';
import type { StatueEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { events } from '../../core/events';
import { findProject } from '../../data/projects';
import { discover, isDiscovered } from '../../domain/discovery';
import { GlowComponent } from './components/GlowComponent';
import { InteractableComponent } from './components/InteractableComponent';
import { createToonMaterial } from '../render/toon';

const GLOW_COLOR = 0xffcc55;
const INTERACT_RADIUS = 2;
const STATUE_COLLISION_RADIUS = 0.5;

export function createStatue(entity: StatueEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const baseMaterial = createToonMaterial({ color: 0x8d95a3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.4, 8), baseMaterial);
    base.position.y = 0.2;

    const bodyMaterial = createToonMaterial({ color: 0xdbe3ee });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.5), bodyMaterial);
    body.position.y = 1.2;

    base.castShadow = true;
    body.castShadow = true;
    group.add(base, body);

    const glow = new GlowComponent(bodyMaterial, GLOW_COLOR);
    const project = findProject(entity.projectId);
    glow.setActive(!!project && !isDiscovered(entity.projectId));

    const label = project ? `Examine ${project.title}` : 'Examine statue';
    const interactable = new InteractableComponent(INTERACT_RADIUS, [{
        key: 'KeyE',
        label,
        run: () => {
            discover(entity.projectId);
            glow.setActive(false);

            const shown = findProject(entity.projectId);
            if (shown) events.emit('projectDiscovered', shown);
        },
    }]);

    return new Entity(entity.id, group, STATUE_COLLISION_RADIUS, true)
        .addComponent('glow', glow)
        .addComponent('interactable', interactable);
}
