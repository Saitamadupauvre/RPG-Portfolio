import type * as THREE from 'three';
import type { AnimatorComponent } from '../animation/AnimatorComponent';
import { collectRig, equip } from '../animation/Rig';
import { loadModel, type LoadedModel } from './loadModel';

const PLAYER_MODEL_URL = 'player/player.glb';
export const PLAYER_HEIGHT = 1.8;

/** The Empty in the Blender file that marks where the sword's grip goes. */
const WEAPON_SOCKET = 'Socket_HandR';

export interface PlayerModelOptions {
    /** Where the model's feet end up on Y, relative to its parent. */
    originY: number;
    /** Moved into the model's hand. */
    sword: THREE.Object3D;
    /** Gets the model's bones and clips. */
    animator: AnimatorComponent;
}

/**
 * The knight as both the world and the book's Level page show it: the model, the sword in its
 * hand, its clips bound to an animator. One place, so the two can never drift apart.
 *
 * Missing pieces only warn: a model without a socket or without clips still stands there.
 */
export async function loadPlayerModel({ originY, sword, animator }: PlayerModelOptions): Promise<LoadedModel> {
    const model = await loadModel(PLAYER_MODEL_URL, { height: PLAYER_HEIGHT, originY });

    if (!equip(model.object, WEAPON_SOCKET, sword)) {
        console.warn(`[player] model has no "${WEAPON_SOCKET}" empty; the sword is not in its hand`);
    }

    if (model.animations.length === 0) {
        console.warn('[player] model has no animations; export the Actions from Blender to bring it to life');
        return model;
    }
    try {
        animator.bind(collectRig(model.object), model.animations);
    } catch (error) {
        console.error('[player] animation setup failed, the model will stand still', error);
    }
    return model;
}
