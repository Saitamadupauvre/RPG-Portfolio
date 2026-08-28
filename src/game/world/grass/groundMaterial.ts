import * as THREE from 'three';
import { createPatchUniforms, PATCH_GLSL } from './groundPalette';

const GROUND_VERTEX_PARS = /* glsl */ `
varying vec2 vGroundXZ;
`;

const GROUND_WORLDPOS = /* glsl */ `
#include <begin_vertex>
vGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
`;

const GROUND_FRAGMENT_PARS = /* glsl */ `
varying vec2 vGroundXZ;
${PATCH_GLSL}
`;

const GROUND_COLOR = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb = grassGroundColor(vGroundXZ);
`;

/**
 * The ground, painted with the same noise patches the grass roots sample.
 * Lambert-based rather than the old raw ShaderMaterial, so it takes the scene
 * lights, fog and shadows — and so its shading matches the blades standing on
 * it. A flat colour here would make the field read as a green bedsheet.
 *
 * Colouring is driven by world XZ, so the pattern does not stretch or repeat
 * with the mesh's UVs and stays continuous across any future ground chunks.
 */
export function createGroundMaterial(): THREE.MeshLambertMaterial {
    const uniforms = createPatchUniforms();
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\n${GROUND_VERTEX_PARS}`)
            .replace('#include <begin_vertex>', GROUND_WORLDPOS);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${GROUND_FRAGMENT_PARS}`)
            .replace('#include <color_fragment>', GROUND_COLOR);
    };

    material.customProgramCacheKey = () => 'patched-ground';

    return material;
}
