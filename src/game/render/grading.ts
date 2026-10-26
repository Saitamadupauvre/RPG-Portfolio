import * as THREE from 'three';

/**
 * How every renderer in the game turns light into screen colour. One function, so the knight
 * on the book's Level page wears exactly the colours it has in the world.
 *
 * Without tone mapping, anything the lights push past 1.0 clips channel by channel and slides
 * toward white — which is what made the greens look washed out. Neutral rolls highlights off
 * while keeping saturation, unlike ACESFilmic which deliberately desaturates them.
 */
export function applyColorGrading(renderer: THREE.WebGLRenderer) {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.12;
}
