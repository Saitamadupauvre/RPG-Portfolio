import type { Entity } from './entities/Entity';
import { resolveCircleOverlap } from '../domain/collision/CircleCollision';

export class EntityCollisionSystem {
    public resolve(bodies: Entity[]) {
        const colliders = bodies.filter((entity) => entity.collisionRadius !== undefined);

        for (let i = 0; i < colliders.length; i++) {
            for (let j = i + 1; j < colliders.length; j++) {
                this.resolvePair(colliders[i], colliders[j]);
            }
        }
    }

    private resolvePair(a: Entity, b: Entity) {
        // Two statues overlapping is a level-design problem, not a runtime one.
        if (a.isStatic && b.isStatic) return;

        const push = resolveCircleOverlap(
            { x: a.mesh.position.x, z: a.mesh.position.z, radius: a.collisionRadius as number },
            { x: b.mesh.position.x, z: b.mesh.position.z, radius: b.collisionRadius as number },
        );
        if (!push) return;

        // A static body takes none of the correction, so the other one absorbs
        // all of it and the statue stays where the level author put it.
        const aShare = a.isStatic ? 0 : b.isStatic ? 1 : 0.5;
        const bShare = 1 - aShare;

        a.mesh.position.x -= push.nx * push.overlap * aShare;
        a.mesh.position.z -= push.nz * push.overlap * aShare;
        b.mesh.position.x += push.nx * push.overlap * bShare;
        b.mesh.position.z += push.nz * push.overlap * bShare;
    }
}
