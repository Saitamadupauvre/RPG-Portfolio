import * as THREE from 'three';
import { createGrassColorUniforms, GRASS_COLOR_GLSL } from './groundPalette';
import { PALETTE } from '../../render/palette';

const GROUND_VERTEX_PARS = /* glsl */ `
varying vec2 vGroundXZ;
varying float vFlatness;
`;

const GROUND_WORLDPOS = /* glsl */ `
#include <begin_vertex>
vGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
vFlatness = normalize(mat3(modelMatrix) * objectNormal).y;
`;

const GROUND_FRAGMENT_PARS = /* glsl */ `
varying vec2 vGroundXZ;
varying float vFlatness;
uniform vec3 uCliffColor;
uniform vec3 uCliffColorDark;
uniform float uCliffStart;
uniform float uCliffEnd;
${GRASS_COLOR_GLSL}
`;

const GROUND_COLOR = /* glsl */ `
#include <color_fragment>
float cliff = 1.0 - smoothstep(uCliffStart, uCliffEnd, vFlatness);
vec3 rockColor = mix(uCliffColorDark, uCliffColor, smoothstep(0.35, 0.65, meadowNoise(vGroundXZ * 0.4)));
diffuseColor.rgb = mix(grassColorAt(vGroundXZ), rockColor, cliff);
`;

const CLIFF_END = Math.cos((30 * Math.PI) / 180);
const CLIFF_START = Math.cos((48 * Math.PI) / 180);
const CLIFF_COLOR = PALETTE.rock;
const CLIFF_COLOR_DARK = PALETTE.bark;

export function createGroundMaterial(): THREE.MeshLambertMaterial {
    const uniforms = {
        ...createGrassColorUniforms(),
        uCliffColor: { value: new THREE.Color(CLIFF_COLOR) },
        uCliffColorDark: { value: new THREE.Color(CLIFF_COLOR_DARK) },
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
            .replace('#include <color_fragment>', GROUND_COLOR);
    };

    material.customProgramCacheKey = () => 'patched-ground';

    return material;
}
