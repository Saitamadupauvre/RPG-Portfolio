import * as THREE from 'three';

/**
 * The nodes an animator may drive, by the names clips use as track targets: bones, and any
 * named empty exported alongside them. A rig is just a lookup built from a loaded model.
 */
export type Rig = Record<string, THREE.Object3D>;

/**
 * Every named node under `root`. Blender exports bones and empties with the names from its
 * outliner, and glTF animation tracks address them by those same names, so collecting by
 * name is all the binding a skinned model needs.
 */
export function collectRig(root: THREE.Object3D): Rig {
    const rig: Rig = {};
    root.traverse((node) => {
        if (!node.name) return;
        if (rig[node.name]) console.warn(`[rig] two nodes are named "${node.name}"; clips will drive the first one found`);
        else rig[node.name] = node;
    });
    return rig;
}

const worldScale = new THREE.Vector3();

/**
 * Parents a weapon (or anything) to a socket: an Empty placed in Blender on a bone, at the
 * grip. A weapon built with its origin at the grip and its blade along +Z then sits right
 * whenever the socket is oriented that way. Returns the socket, or null when the model has
 * none by that name.
 *
 * The item keeps its authored size: models are scaled to fit their height, and a socket
 * deep in a scaled hierarchy would otherwise shrink whatever hangs off it.
 */
export function equip(root: THREE.Object3D, socketName: string, item: THREE.Object3D): THREE.Object3D | null {
    const socket = root.getObjectByName(socketName);
    if (!socket) return null;

    socket.add(item);
    socket.updateWorldMatrix(true, false);
    socket.getWorldScale(worldScale);
    item.scale.set(1 / worldScale.x, 1 / worldScale.y, 1 / worldScale.z);
    return socket;
}
