import * as THREE from "three";

// Same palette as GroundMaterial's patches, so blades tint with the ground beneath them.
const GROUND_COLOR_A = new THREE.Color(0x4a8f3c);
const GROUND_COLOR_B = new THREE.Color(0x5cb85c);
const GROUND_COLOR_C = new THREE.Color(0x3f7a33);
const GROUND_COLOR_ACCENT = new THREE.Color(0xb8c93a);
const SUN_DIRECTION = new THREE.Vector3(10, 15, 8).normalize();

const BLADE_WIDTH = 0.22;
const BLADE_TIP_WIDTH = 0.08;
const BLADE_HEIGHT = 0.4;

function buildBladeGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    // Two crossed quads (trapezoid, base wider than tip) instead of one flat
    // triangle, so blades read as volumetric from any camera angle.
    const quad = (angle: number) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotate = (x: number, z: number): [number, number] => [x * cos - z * sin, x * sin + z * cos];

        const bl = rotate(-BLADE_WIDTH / 2, 0);
        const br = rotate(BLADE_WIDTH / 2, 0);
        const tl = rotate(-BLADE_TIP_WIDTH / 2, 0);
        const tr = rotate(BLADE_TIP_WIDTH / 2, 0);

        return [
            bl[0], 0, bl[1],
            br[0], 0, br[1],
            tr[0], BLADE_HEIGHT, tr[1],

            bl[0], 0, bl[1],
            tr[0], BLADE_HEIGHT, tr[1],
            tl[0], BLADE_HEIGHT, tl[1],
        ];
    };

    const positions = new Float32Array([
        ...quad(0),
        ...quad(Math.PI / 2),
    ]);
    const uvs = new Float32Array([
        0, 0, 1, 0, 1, 1,
        0, 0, 1, 1, 0, 1,

        0, 0, 1, 0, 1, 1,
        0, 0, 1, 1, 0, 1,
    ]);

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();

    return geometry;
}

export const GRASS_BLADE_GEOMETRY = buildBladeGeometry();

export function createGrassMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColorA: { value: GROUND_COLOR_A },
            uColorB: { value: GROUND_COLOR_B },
            uColorC: { value: GROUND_COLOR_C },
            uColorAccent: { value: GROUND_COLOR_ACCENT },
            uSunDirection: { value: SUN_DIRECTION },
        },
        vertexShader: `
            uniform float uTime;
            varying vec2 vUv;
            varying vec2 vWorldXZ;

            void main() {
                vUv = uv;
                vec3 pos = position;

                float windStrength = uv.y * uv.y;
                float phase = instanceMatrix[3].x + instanceMatrix[3].z;
                float sway = sin(uTime * 2.0 + phase) * 0.15;
                pos.x += sway * windStrength;

                vec4 worldPosition = instanceMatrix * vec4(pos, 1.0);
                vWorldXZ = worldPosition.xz;
                gl_Position = projectionMatrix * modelViewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            uniform vec3 uColorC;
            uniform vec3 uColorAccent;
            uniform vec3 uSunDirection;
            varying vec2 vUv;
            varying vec2 vWorldXZ;

            vec3 linearToSRGB(vec3 c) {
                return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
            }

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float valueNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);

                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));

                return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            void main() {
                // Same patch noise as the ground shader, so blades match the patch below them.
                float n1 = smoothstep(0.35, 0.65, valueNoise(vWorldXZ * 0.15));
                float n2 = smoothstep(0.4, 0.6, valueNoise(vWorldXZ * 0.4 + 100.0));
                float n3 = valueNoise(vWorldXZ * 1.8 + 250.0);

                vec3 patchColor = mix(uColorA, uColorB, n1);
                patchColor = mix(patchColor, uColorC, n2 * 0.6);
                patchColor = mix(patchColor, uColorAccent, smoothstep(0.88, 0.95, n3) * 0.8);

                vec3 tipColor = patchColor * 0.7;
                vec3 color = mix(patchColor, tipColor, vUv.y);

                gl_FragColor = vec4(linearToSRGB(color), 1.0);
            }
        `,
    });
}

export function createGrassInstancedMesh(
    positions: THREE.Vector3[],
    material: THREE.ShaderMaterial = createGrassMaterial(),
): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(GRASS_BLADE_GEOMETRY, material, positions.length);

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const yaw = new THREE.Quaternion();
    const lean = new THREE.Quaternion();
    const leanAxis = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (let i = 0; i < positions.length; i++) {
        yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);

        // Slight random lean (not pure vertical) so tips scatter direction like real clumps.
        leanAxis.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        lean.setFromAxisAngle(leanAxis, Math.random() * 0.35);
        quaternion.multiplyQuaternions(lean, yaw);

        const widthScale = 0.8 + Math.random() * 0.4;
        const heightScale = 0.6 + Math.random() * 0.9;
        scale.set(widthScale, heightScale, widthScale);

        matrix.compose(positions[i], quaternion, scale);
        mesh.setMatrixAt(i, matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
}

function buildChunkPositions(centerX: number, centerZ: number, chunkSize: number, cellSize: number): THREE.Vector3[] {
    const positions: THREE.Vector3[] = [];
    const half = chunkSize / 2;
    const cellsPerSide = Math.round(chunkSize / cellSize);

    for (let ix = 0; ix < cellsPerSide; ix++) {
        for (let iz = 0; iz < cellsPerSide; iz++) {
            const jitterX = (Math.random() - 0.5) * cellSize;
            const jitterZ = (Math.random() - 0.5) * cellSize;
            const x = centerX - half + (ix + 0.5) * cellSize + jitterX;
            const z = centerZ - half + (iz + 0.5) * cellSize + jitterZ;
            positions.push(new THREE.Vector3(x, 0, z));
        }
    }

    return positions;
}

type GrassChunk = {
    mesh: THREE.InstancedMesh;
    bounds: THREE.Box3;
    center: THREE.Vector3;
};

const MAX_RENDER_DISTANCE = 55;

export class Grass {
    group: THREE.Group;
    private material: THREE.ShaderMaterial;
    private chunks: GrassChunk[] = [];
    private frustum = new THREE.Frustum();
    private projScreenMatrix = new THREE.Matrix4();

    constructor(groundSize: number, chunkSize = 10, cellSize = 0.12) {
        this.material = createGrassMaterial();

        const half = groundSize / 2;
        const chunksPerSide = Math.round(groundSize / chunkSize);

        for (let cx = 0; cx < chunksPerSide; cx++) {
            for (let cz = 0; cz < chunksPerSide; cz++) {
                const centerX = -half + (cx + 0.5) * chunkSize;
                const centerZ = -half + (cz + 0.5) * chunkSize;
                const positions = buildChunkPositions(centerX, centerZ, chunkSize, cellSize);
                const mesh = createGrassInstancedMesh(positions, this.material);

                const center = new THREE.Vector3(centerX, BLADE_HEIGHT / 2, centerZ);
                const bounds = new THREE.Box3().setFromCenterAndSize(
                    center,
                    new THREE.Vector3(chunkSize, BLADE_HEIGHT, chunkSize),
                );

                this.chunks.push({ mesh, bounds, center });
            }
        }

        this.group = new THREE.Group();
        for (const chunk of this.chunks) {
            this.group.add(chunk.mesh);
        }
    }

    update(elapsed: number, camera: THREE.Camera, playerPosition: THREE.Vector3) {
        this.material.uniforms.uTime.value = elapsed;

        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        for (const chunk of this.chunks) {
            const inRange = chunk.center.distanceTo(playerPosition) <= MAX_RENDER_DISTANCE;
            chunk.mesh.visible = inRange && this.frustum.intersectsBox(chunk.bounds);
        }
    }
}
