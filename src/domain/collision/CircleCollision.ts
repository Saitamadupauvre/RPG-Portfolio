export interface Circle {
    x: number;
    z: number;
    radius: number;
}

export interface Push {
    ax: number;
    az: number;
    bx: number;
    bz: number;
}

// Pure XZ circle-overlap resolution: returns corrected positions that split the overlap
// evenly between both circles, or null if they don't overlap. No THREE dependency so it
// stays testable/derivable independent of the render layer.
export function resolveCircleOverlap(a: Circle, b: Circle): Push | null {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const distSq = dx * dx + dz * dz;
    const minDist = a.radius + b.radius;

    if (distSq >= minDist * minDist) return null;

    const dist = Math.sqrt(distSq);
    // Circles share the exact same point — push along an arbitrary axis to separate them.
    const [nx, nz] = dist === 0 ? [1, 0] : [dx / dist, dz / dist];
    const overlap = minDist - dist;
    const half = overlap / 2;

    return {
        ax: a.x - nx * half,
        az: a.z - nz * half,
        bx: b.x + nx * half,
        bz: b.z + nz * half,
    };
}
