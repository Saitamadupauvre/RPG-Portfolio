import * as THREE from 'three';

export interface ParticleSystemConfig {
    size?: number;
    color?: number;
    poolSize?: number;
    life?: number;
    speed?: number;
    verticalSpeed?: number;
    gravity?: number;
    particlesPerBurst?: number;
}

const DEFAULTS: Required<ParticleSystemConfig> = {
    size: 0.06,
    color: 0xffffff,
    poolSize: 64,
    life: 0.4,
    speed: 2.5,
    verticalSpeed: 2,
    gravity: 6,
    particlesPerBurst: 8,
};

interface Particle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    active: boolean;
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _matrix = new THREE.Matrix4();

/**
 * Pooled box-particle emitter. One reusable engine for hit sparks, dust, and weapon trails.
 *
 * All particles of a system are instances of one InstancedMesh: one draw call
 * however many are alive, where a Mesh + material per particle cost one each.
 * Instances cannot have their own material opacity, so the fade is a
 * per-instance `aAlpha` attribute patched into the basic material's shader.
 */
export class ParticleSystem {
    private particles: Particle[] = [];
    private config: Required<ParticleSystemConfig>;
    private mesh: THREE.InstancedMesh;
    private alpha: THREE.InstancedBufferAttribute;

    constructor(parent: THREE.Object3D, config: ParticleSystemConfig = {}) {
        this.config = { ...DEFAULTS, ...config };
        const { size, poolSize, color } = this.config;

        const geometry = new THREE.BoxGeometry(size, size, size);
        this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(poolSize), 1);
        this.alpha.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('aAlpha', this.alpha);

        const material = new THREE.MeshBasicMaterial({ color, transparent: true });
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = 'attribute float aAlpha;\nvarying float vAlpha;\n' + shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\n\tvAlpha = aAlpha;',
            );
            shader.fragmentShader = 'varying float vAlpha;\n' + shader.fragmentShader.replace(
                '#include <color_fragment>',
                '#include <color_fragment>\n\tdiffuseColor.a *= vAlpha;',
            );
        };

        this.mesh = new THREE.InstancedMesh(geometry, material, poolSize);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Instances fly anywhere; the mesh's own bounds would cull them wrongly.
        this.mesh.frustumCulled = false;
        for (let i = 0; i < poolSize; i++) {
            this.mesh.setMatrixAt(i, HIDDEN);
            this.particles.push({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, active: false });
        }
        parent.add(this.mesh);
    }

    public spawnBurst(position: THREE.Vector3, count = this.config.particlesPerBurst) {
        let spawned = 0;
        for (const particle of this.particles) {
            if (spawned >= count) break;
            if (particle.active) continue;

            const angle = Math.random() * Math.PI * 2;
            const speed = this.config.speed * (0.5 + Math.random() * 0.5);

            particle.active = true;
            particle.life = this.config.life;
            particle.position.copy(position);
            particle.velocity.set(
                Math.cos(angle) * speed,
                Math.random() * this.config.verticalSpeed,
                Math.sin(angle) * speed,
            );
            spawned++;
        }
    }

    public update(dt: number) {
        let changed = false;

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            if (!particle.active) continue;
            changed = true;

            particle.life -= dt;
            if (particle.life <= 0) {
                particle.active = false;
                this.mesh.setMatrixAt(i, HIDDEN);
                continue;
            }

            particle.velocity.y -= this.config.gravity * dt;
            particle.position.addScaledVector(particle.velocity, dt);
            this.mesh.setMatrixAt(i, _matrix.makeTranslation(particle.position));
            this.alpha.setX(i, particle.life / this.config.life);
        }

        if (changed) {
            this.mesh.instanceMatrix.needsUpdate = true;
            this.alpha.needsUpdate = true;
        }
    }
}
