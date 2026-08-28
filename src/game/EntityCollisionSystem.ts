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
        const push = resolveCircleOverlap(
            { x: a.mesh.position.x, z: a.mesh.position.z, radius: a.collisionRadius as number },
            { x: b.mesh.position.x, z: b.mesh.position.z, radius: b.collisionRadius as number },
        );
        if (!push) return;

        a.mesh.position.x = push.ax;
        a.mesh.position.z = push.az;
        b.mesh.position.x = push.bx;
        b.mesh.position.z = push.bz;
    }
}
