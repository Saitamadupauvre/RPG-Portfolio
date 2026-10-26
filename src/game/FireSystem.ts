import * as THREE from 'three';
import { PALETTE } from './render/palette';
import { isInsideObstacle } from './world/obstacles';
import { groundHeight } from './world/terrainField';

/** Puffs alive at once; a dragon breathes about 30 a second for under a second of life each. */
const POOL_SIZE = 160;
/** Radius of a puff when it leaves the mouth, and once it has billowed out, before the breath's own `size`. */
const START_SIZE = 0.16;
const END_SIZE = 0.75;
/** How fast a puff loses its speed (per second, exponential): a jet that slows into a cloud. */
const DRAG = 2.2;
/** Upward pull on the hot gas, growing as the puff ages. */
const RISE = 3;
/** Share of its life a puff can still burn: the smoke at the end is harmless. */
const HOT = 0.65;
/** Seconds between two burns, however many puffs touch the player: standing in the stream hurts in ticks. */
const BURN_INTERVAL = 0.25;
/** How much of a puff's radius counts for the burn, so only the core of the cloud hurts. */
const BURN_REACH = 0.7;
/** Rise in the ground a puff rolling along it still climbs (a ramp); anything steeper is a wall. */
const STEP = 0.25;

/** Colour along a puff's life: white-hot at the mouth, gold, red flame, then dark smoke. */
const COLOURS: { t: number; color: THREE.Color }[] = [
    { t: 0, color: new THREE.Color(PALETTE.cream) },
    { t: 0.15, color: new THREE.Color(PALETTE.gold) },
    { t: 0.45, color: new THREE.Color(PALETTE.ember) },
    { t: 0.7, color: new THREE.Color(PALETTE.berry) },
    { t: 1, color: new THREE.Color(PALETTE.stoneDeep) },
];

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export interface FlameOptions {
    speed: number;
    /** Seconds a puff lives, which sets how far the breath reaches with `speed` and the drag. */
    life: number;
    damage: number;
    /** Scale of the puffs and of what they burn: below 1 for a small mouth. 1 by default. */
    size?: number;
}

interface Puff {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    spin: THREE.Euler;
    age: number;
    life: number;
    damage: number;
    size: number;
    active: boolean;
}

/**
 * Every flame in the air, pooled like the arrows of ProjectileSystem and drawn like
 * ParticleSystem: one InstancedMesh, a per-instance alpha patched into an unlit material,
 * a per-instance colour on top. A breath is a stream of puffs that slow, swell, rise and
 * cool into smoke; a puff meeting the ground, a trunk or a rock stops there, so cover works.
 * Damage is not dealt here: `update` reports the burn and CombatSystem applies it.
 */
export class FireSystem {
    private puffs: Puff[] = [];
    private mesh: THREE.InstancedMesh;
    private alpha: THREE.InstancedBufferAttribute;
    private burnCooldown = 0;

    private matrix = new THREE.Matrix4();
    private rotation = new THREE.Quaternion();
    private scale = new THREE.Vector3();
    private color = new THREE.Color();

    constructor(parent: THREE.Object3D) {
        // A low-poly ball: the flame reads as chunks of fire, like the rest of the world's facets.
        const geometry = new THREE.IcosahedronGeometry(1, 0);
        this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(POOL_SIZE), 1);
        this.alpha.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('aAlpha', this.alpha);

        // Unlit and drawn after the opaque world: fire makes its own light, and puffs overlap.
        const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
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

        this.mesh = new THREE.InstancedMesh(geometry, material, POOL_SIZE);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        for (let i = 0; i < POOL_SIZE; i++) {
            this.mesh.setMatrixAt(i, HIDDEN);
            // Creates the instanceColor buffer, which the material then reads.
            this.mesh.setColorAt(i, COLOURS[0].color);
            this.puffs.push({
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                spin: new THREE.Euler(),
                age: 0,
                life: 1,
                damage: 0,
                size: 1,
                active: false,
            });
        }
        parent.add(this.mesh);
    }

    /** One puff from `from` along `direction` (unit). Dropped when every puff is in the air. */
    public emit(from: THREE.Vector3, direction: THREE.Vector3, options: FlameOptions) {
        const puff = this.puffs.find((candidate) => !candidate.active);
        if (!puff) return;

        puff.active = true;
        puff.age = 0;
        puff.life = options.life * (0.85 + Math.random() * 0.3);
        puff.damage = options.damage;
        puff.size = options.size ?? 1;
        puff.position.copy(from);
        puff.velocity.copy(direction).multiplyScalar(options.speed * (0.9 + Math.random() * 0.2));
        puff.spin.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    }

    public update(dt: number, target: THREE.Box3, onBurn: (damage: number, point: THREE.Vector3) => void) {
        if (this.burnCooldown > 0) this.burnCooldown -= dt;

        let changed = false;
        for (let i = 0; i < this.puffs.length; i++) {
            const puff = this.puffs[i];
            if (!puff.active) continue;
            changed = true;

            puff.age += dt;
            const t = puff.age / puff.life;
            if (t >= 1) {
                puff.active = false;
                this.mesh.setMatrixAt(i, HIDDEN);
                this.alpha.setX(i, 0);
                continue;
            }

            this.move(puff, dt, t);
            const size = THREE.MathUtils.lerp(START_SIZE, END_SIZE, Math.sqrt(t)) * puff.size;

            if (t < HOT && this.burnCooldown <= 0 && target.distanceToPoint(puff.position) < size * BURN_REACH) {
                this.burnCooldown = BURN_INTERVAL;
                onBurn(puff.damage, puff.position);
            }

            puff.spin.x += dt * 3;
            this.rotation.setFromEuler(puff.spin);
            this.matrix.compose(puff.position, this.rotation, this.scale.setScalar(size));
            this.mesh.setMatrixAt(i, this.matrix);
            this.mesh.setColorAt(i, colourAt(t, this.color));
            // Solid while it burns, thinning out as smoke.
            this.alpha.setX(i, t < 0.5 ? 0.95 : 0.95 * (1 - (t - 0.5) / 0.5));
        }

        if (changed) {
            this.mesh.instanceMatrix.needsUpdate = true;
            if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
            this.alpha.needsUpdate = true;
        }
    }

    /** Puts every flame out: a bonfire rest or a respawn resets the fight. */
    public clear() {
        for (let i = 0; i < this.puffs.length; i++) {
            this.puffs[i].active = false;
            this.mesh.setMatrixAt(i, HIDDEN);
            this.alpha.setX(i, 0);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.alpha.needsUpdate = true;
        this.burnCooldown = 0;
    }

    private move(puff: Puff, dt: number, t: number) {
        puff.velocity.multiplyScalar(Math.exp(-DRAG * dt));
        puff.velocity.y += RISE * t * dt;
        const { position, velocity } = puff;
        const nextX = position.x + velocity.x * dt;
        const nextZ = position.z + velocity.z * dt;
        const ground = groundHeight(nextX, nextZ);
        // Flames splash against a cliff face, a trunk or a rock and spread no further: hiding behind one works.
        if (ground - position.y > STEP || isInsideObstacle(nextX, nextZ, position.y - ground)) {
            velocity.x = 0;
            velocity.z = 0;
        } else {
            position.x = nextX;
            position.z = nextZ;
        }
        position.y += velocity.y * dt;
        // Rolls along the ground rather than through it.
        const floor = groundHeight(position.x, position.z) + 0.1;
        if (position.y < floor) {
            position.y = floor;
            velocity.y = Math.max(0, velocity.y);
        }
    }
}

function colourAt(t: number, out: THREE.Color): THREE.Color {
    for (let i = 1; i < COLOURS.length; i++) {
        const next = COLOURS[i];
        if (t <= next.t) {
            const previous = COLOURS[i - 1];
            return out.lerpColors(previous.color, next.color, (t - previous.t) / (next.t - previous.t));
        }
    }
    return out.copy(COLOURS[COLOURS.length - 1].color);
}
