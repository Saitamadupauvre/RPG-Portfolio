import * as THREE from 'three';
import type { ChestEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { events } from '../../core/events';
import { applyChestLoot } from '../../domain/chestLoot';
import { isChestOpened, openChest } from '../../domain/openedChests';
import { GlowComponent } from './components/GlowComponent';
import { InteractableComponent } from './components/InteractableComponent';
import { findMaterial, loadModel } from './loadModel';
import { disposeObject3D } from './disposeObject3D';
import { createLitMaterial } from '../render/materials';
import { PALETTE } from '../render/palette';
import { CHEST_COLLISION_RADIUS, CHEST_HEIGHT } from './collisionSizes';

const chestColor: Record<ChestEntity['chestTier'], number> = {
    wood: PALETTE.bark,
    silver: PALETTE.stone,
    gold: PALETTE.gold,
};

/**
 * The model's materials a tier recolours, by name: the metal bands ("Trim") show the tier.
 * The wood tier keeps the model's own dark iron.
 */
const tierColors: Record<ChestEntity['chestTier'], Partial<Record<string, number>>> = {
    wood: {},
    silver: { Trim: PALETTE.steel },
    gold: { Trim: PALETTE.gold },
};

const GLOW_COLOR = PALETTE.gold;
const INTERACT_RADIUS = 2;
const LID_OPEN_ANGLE = -Math.PI / 2.4;
const MODEL_URL = 'models/chest.glb';

export function createChest(entity: ChestEntity): Entity {
    const group = new THREE.Group();
    applyTransform(group, entity);

    const color = chestColor[entity.chestTier];
    const bodyMaterial = createLitMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.6), bodyMaterial);
    body.position.y = 0.225;
    body.castShadow = true;

    // The lid pivots on its back edge, so it lives in its own group whose origin
    // sits at that hinge — rotating the mesh directly would spin it around its center.
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.45, -0.3);

    const lidMaterial = createLitMaterial({ color });
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.6), lidMaterial);
    lid.position.set(0, 0.075, 0.3);
    lid.castShadow = true;
    hinge.add(lid);

    group.add(body, hinge);

    // Whichever lid is showing: the stand-in's hinge, then the model's "Lid" node, whose origin is its hinge too.
    let pivot: THREE.Object3D = hinge;
    let opened = isChestOpened(entity.id);
    if (opened) pivot.rotation.x = LID_OPEN_ANGLE;

    const glow = new GlowComponent(bodyMaterial, GLOW_COLOR);
    glow.setActive(!opened);

    // The primitives above stand in until the model arrives (and stay if it never does).
    loadModel(MODEL_URL, { height: CHEST_HEIGHT })
        .then(({ object, materials }) => {
            const modelLid = object.getObjectByName('Lid');
            // The gold lock and studs glow, not the bands: the bands' colour is what tells the tiers apart.
            const lock = findMaterial(materials, 'Lock');
            if (!modelLid || !lock) throw new Error('chest.glb needs a "Lid" node and a "Lock" material');

            for (const material of materials) {
                const tint = tierColors[entity.chestTier][material.name];
                if (tint !== undefined) material.color.set(tint);
            }

            group.remove(body, hinge);
            disposeObject3D(body);
            disposeObject3D(hinge);
            group.add(object);

            pivot = modelLid;
            if (opened) pivot.rotation.x = LID_OPEN_ANGLE;
            glow.setMaterials(lock);
        })
        .catch((error) => console.error('[chest] model failed to load, keeping placeholder', error));

    const interactable = new InteractableComponent(INTERACT_RADIUS, [{
        input: 'interact',
        label: 'Open chest',
        run: () => {
            if (!openChest(entity.id)) return;

            opened = true;
            glow.setActive(false);
            pivot.rotation.x = LID_OPEN_ANGLE;
            interactable.actions = [];

            events.emit('chestOpened', applyChestLoot(entity.loot));
        },
    }]);

    if (opened) interactable.actions = [];

    return new Entity(entity.id, group, CHEST_COLLISION_RADIUS, true)
        .addComponent('glow', glow)
        .addComponent('interactable', interactable);
}
