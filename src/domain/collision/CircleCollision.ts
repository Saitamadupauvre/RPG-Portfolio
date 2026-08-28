export interface Circle {
    x: number;
    z: number;
    radius: number;
}

export interface Push {
    /** Unit vector from a to b; b moves along it, a against it. */
    nx: number;
    nz: number;
    overlap: number;
}

/** How deep two circles overlap and along which axis. Who moves is the caller's call. */
export function resolveCircleOverlap(a: Circle, b: Circle): Push | null {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const distSq = dx * dx + dz * dz;
    const minDist = a.radius + b.radius;

    if (distSq >= minDist * minDist) return null;

    const dist = Math.sqrt(distSq);

    const [nx, nz] = dist === 0 ? [1, 0] : [dx / dist, dz / dist];
    return { nx, nz, overlap: minDist - dist };
}
