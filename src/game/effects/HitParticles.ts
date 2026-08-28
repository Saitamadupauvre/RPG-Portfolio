import * as THREE from 'three';

interface Particle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    active: boolean;
}

const PARTICLES_PER_BURST = 8;
const POOL_SIZE = 64;
const PARTICLE_LIFE = 0.4;
const PARTICLE_SPEED = 2.5;
const GRAVITY = 6;

export class HitParticles {
    private particles: Particle[] = [];

    constructor(parent: THREE.Object3D) {
        const geometry = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        for (let i = 0; i < POOL_SIZE; i++) {
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            parent.add(mesh);
            this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0, active: false });
        }
    }

    public spawnBurst(position: THREE.Vector3) {
        let spawned = 0;
        for (const particle of this.particles) {
            if (particle.active) continue;

            particle.active = true;
            particle.life = PARTICLE_LIFE;
            particle.mesh.visible = true;
            particle.mesh.position.copy(position);
            (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 1;

            const angle = Math.random() * Math.PI * 2;
            const speed = PARTICLE_SPEED * (0.5 + Math.random() * 0.5);
            particle.velocity.set(Math.cos(angle) * speed, Math.random() * 2, Math.sin(angle) * speed);

            if (++spawned >= PARTICLES_PER_BURST) break;
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

            particle.velocity.y -= GRAVITY * dt;
            particle.mesh.position.addScaledVector(particle.velocity, dt);
            (particle.mesh.material as THREE.MeshBasicMaterial).opacity = particle.life / PARTICLE_LIFE;
        }
    }
}
