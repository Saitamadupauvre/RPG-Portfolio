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
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    active: boolean;
}

/** Pooled box-particle emitter. One reusable engine for hit sparks, dust, and weapon trails. */
export class ParticleSystem {
    private particles: Particle[] = [];
    private config: Required<ParticleSystemConfig>;

    constructor(parent: THREE.Object3D, config: ParticleSystemConfig = {}) {
        this.config = { ...DEFAULTS, ...config };
        const geometry = new THREE.BoxGeometry(this.config.size, this.config.size, this.config.size);

        for (let i = 0; i < this.config.poolSize; i++) {
            const material = new THREE.MeshBasicMaterial({ color: this.config.color, transparent: true });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            parent.add(mesh);
            this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0, active: false });
        }
    }

    public spawnBurst(position: THREE.Vector3, count = this.config.particlesPerBurst) {
        for (let i = 0; i < count; i++) {
            const particle = this.particles.find((p) => !p.active);
            if (!particle) break;

            const angle = Math.random() * Math.PI * 2;
            const speed = this.config.speed * (0.5 + Math.random() * 0.5);

            particle.active = true;
            particle.life = this.config.life;
            particle.mesh.visible = true;
            particle.mesh.position.copy(position);
            particle.velocity.set(
                Math.cos(angle) * speed,
                Math.random() * this.config.verticalSpeed,
                Math.sin(angle) * speed,
            );
            (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
        }
    }

    public update(dt: number) {
        for (const particle of this.particles) {
            if (!particle.active) continue;

            particle.life -= dt;
            if (particle.life <= 0) {
                particle.active = false;
                particle.mesh.visible = false;
                continue;
            }

            particle.velocity.y -= this.config.gravity * dt;
            particle.mesh.position.addScaledVector(particle.velocity, dt);
            (particle.mesh.material as THREE.MeshBasicMaterial).opacity = particle.life / this.config.life;
        }
    }
}
