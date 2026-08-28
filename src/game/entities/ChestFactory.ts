import * as THREE from 'three';
import type { ChestEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { events } from '../../core/events';
import { applyChestLoot } from '../../domain/chestLoot';
import { isChestOpened, openChest } from '../../domain/openedChests';
import { GlowComponent } from './components/GlowComponent';
import { InteractableComponent } from './components/InteractableComponent';

const chestColor: Record<ChestEntity['chestTier'], number> = {
    wood: 0x8b5a2b,
    silver: 0xc0c0c0,
    gold: 0xffd700,
};

const GLOW_COLOR = 0xffcc55;
const INTERACT_RADIUS = 2;
const COLLISION_RADIUS = 0.5;
const LID_OPEN_ANGLE = -Math.PI / 2.4;

export function createChest(entity: ChestEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const color = chestColor[entity.chestTier];
    const bodyMaterial = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.6), bodyMaterial);
    body.position.y = 0.225;
    body.castShadow = true;

    // The lid pivots on its back edge, so it lives in its own group whose origin
    // sits at that hinge — rotating the mesh directly would spin it around its center.
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.45, -0.3);

    const lidMaterial = new THREE.MeshStandardMaterial({ color });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.6), lidMaterial);
    lid.position.set(0, 0.075, 0.3);
    lid.castShadow = true;
    hinge.add(lid);

    group.add(body, hinge);

    const alreadyOpened = isChestOpened(entity.id);
    if (alreadyOpened) hinge.rotation.x = LID_OPEN_ANGLE;

    const glow = new GlowComponent(bodyMaterial, GLOW_COLOR);
    glow.setActive(!alreadyOpened);

    const interactable = new InteractableComponent(INTERACT_RADIUS, [{
        key: 'KeyE',
        label: 'Open chest',
        run: () => {
            if (!openChest(entity.id)) return;

            glow.setActive(false);
            hinge.rotation.x = LID_OPEN_ANGLE;
            interactable.actions = [];

            events.emit('chestOpened', applyChestLoot(entity.loot));
        },
    }]);

    if (alreadyOpened) interactable.actions = [];

    return new Entity(entity.id, group, COLLISION_RADIUS, true)
        .addComponent('glow', glow)
        .addComponent('interactable', interactable);
}
