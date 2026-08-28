import * as THREE from 'three';
import type { StatueEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { events } from '../../core/events';
import { discover, getProject, isDiscovered } from '../../domain/discovery';
import { GlowComponent } from './components/GlowComponent';
import { InteractableComponent } from './components/InteractableComponent';

const GLOW_COLOR = 0xffcc55;
const INTERACT_RADIUS = 2;
const STATUE_COLLISION_RADIUS = 0.5;

export function createStatue(entity: StatueEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa0a6 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.4, 8), baseMaterial);
    base.position.y = 0.2;

    // The body is the part that glows, so it gets its own material instance —
    // sharing one with the base would make the pedestal light up too.
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xc8ccd0 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.5), bodyMaterial);
    body.position.y = 1.2;

    base.castShadow = true;
    body.castShadow = true;
    group.add(base, body);

    const glow = new GlowComponent(bodyMaterial, GLOW_COLOR);
    const project = getProject(entity.projectId);
    glow.setActive(!!project && !isDiscovered(entity.projectId));

    const label = project ? `Examine ${project.title}` : 'Examine statue';
    const interactable = new InteractableComponent(INTERACT_RADIUS, label, () => {
        // Statues stay interactable forever: re-reading a project is allowed, only the
        // first press counts as a discovery (that's what `discover` returning undefined means).
        discover(entity.projectId);
        glow.setActive(false);

        const shown = getProject(entity.projectId);
        if (shown) events.emit('projectDiscovered', shown);
    });

    return new Entity(entity.id, group, STATUE_COLLISION_RADIUS)
        .addComponent('glow', glow)
        .addComponent('interactable', interactable);
}
