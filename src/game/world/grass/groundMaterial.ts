import * as THREE from 'three';
import { TOON_LIGHTING_GLSL } from '../../render/toonLighting';
import { createPatchUniforms, PATCH_GLSL } from './groundPalette';

const GROUND_VERTEX_PARS = /* glsl */ `
varying vec2 vGroundXZ;
varying float vFlatness;
`;

const GROUND_WORLDPOS = /* glsl */ `
#include <begin_vertex>
vGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
// The normal's Y is the cosine of the slope: 1 flat, 0 vertical. Carrying it as
// a varying means the cliff blend costs one interpolated float, no extra maths.
vFlatness = normalize(mat3(modelMatrix) * objectNormal).y;
`;

const GROUND_FRAGMENT_PARS = /* glsl */ `
varying vec2 vGroundXZ;
varying float vFlatness;
uniform vec3 uCliffColor;
uniform float uCliffStart;
uniform float uCliffEnd;
${PATCH_GLSL}
`;

/**
 * Steep faces blend to bare rock, which is what makes a cliff read as a cliff
 * without a second material or a second draw call. The blend is driven by the
 * surface normal, so it lands on the tile walls automatically — nothing has to
 * tag them.
 */
const GROUND_COLOR = /* glsl */ `
#include <color_fragment>
float cliff = 1.0 - smoothstep(uCliffStart, uCliffEnd, vFlatness);
diffuseColor.rgb = mix(grassGroundColor(vGroundXZ), uCliffColor, cliff);
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
/** Cosine of the slope where rock starts taking over, and where it fully has. */
const CLIFF_END = Math.cos((30 * Math.PI) / 180);
const CLIFF_START = Math.cos((48 * Math.PI) / 180);
const CLIFF_COLOR = 0x7d7469;

export function createGroundMaterial(): THREE.MeshLambertMaterial {
    const uniforms = {
        ...createPatchUniforms(),
        uCliffColor: { value: new THREE.Color(CLIFF_COLOR) },
        uCliffStart: { value: CLIFF_START },
        uCliffEnd: { value: CLIFF_END },
    };
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\n${GROUND_VERTEX_PARS}`)
            .replace('#include <begin_vertex>', GROUND_WORLDPOS);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${GROUND_FRAGMENT_PARS}`)
            .replace('#include <lights_fragment_end>', TOON_LIGHTING_GLSL)
            .replace('#include <color_fragment>', GROUND_COLOR);
    };

    material.customProgramCacheKey = () => 'patched-ground';

    return material;
}
