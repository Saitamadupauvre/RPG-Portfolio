import * as THREE from 'three';
import type { StatueEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { events } from '../../core/events';
import { findProject } from '../../data/projects';
import { discover, isDiscovered } from '../../domain/discovery';
import { GlowComponent } from './components/GlowComponent';
import { InteractableComponent } from './components/InteractableComponent';
import { createLitMaterial } from '../render/materials';
import { PALETTE } from '../render/palette';

const GLOW_COLOR = PALETTE.gold;
const INTERACT_RADIUS = 2;
const STATUE_COLLISION_RADIUS = 0.5;

export function createStatue(entity: StatueEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const baseMaterial = createLitMaterial({ color: PALETTE.stone });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.4, 8), baseMaterial);
    base.position.y = 0.2;

    const bodyMaterial = createLitMaterial({ color: PALETTE.cream });
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
            glow.setActive(false);

            // Re-reading a statue shows the card again but is not a new discovery.
            const discovered = discover(entity.projectId);
            if (discovered) events.emit('projectDiscovered', discovered);

            if (project) events.emit('projectShown', project);
        },
    }]);

    return new Entity(entity.id, group, STATUE_COLLISION_RADIUS, true)
        .addComponent('glow', glow)
        .addComponent('interactable', interactable);
}
