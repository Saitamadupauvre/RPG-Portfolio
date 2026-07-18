import * as THREE from "three";

export function createGroundMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        uniforms: {
            uColorA: { value: new THREE.Color(0x4a8f3c) },
            uColorB: { value: new THREE.Color(0x5cb85c) },
            uColorC: { value: new THREE.Color(0x3f7a33) },
            uColorAccent: { value: new THREE.Color(0xb8c93a) },
        },
        vertexShader: `
            varying vec2 vWorldXZ;

            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldXZ = worldPosition.xz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 uColorA;
            uniform vec3 uColorB;
            uniform vec3 uColorC;
            uniform vec3 uColorAccent;
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
                float n1 = smoothstep(0.35, 0.65, valueNoise(vWorldXZ * 0.15));
                float n2 = smoothstep(0.4, 0.6, valueNoise(vWorldXZ * 0.4 + 100.0));
                float n3 = valueNoise(vWorldXZ * 1.8 + 250.0);

                vec3 color = mix(uColorA, uColorB, n1);
                color = mix(color, uColorC, n2 * 0.6);
                color = mix(color, uColorAccent, smoothstep(0.88, 0.95, n3) * 0.8);

                gl_FragColor = vec4(linearToSRGB(color), 1.0);
            }
        `,
    });
}
