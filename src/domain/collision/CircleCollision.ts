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

export function resolveCircleOverlap(a: Circle, b: Circle): Push | null {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const distSq = dx * dx + dz * dz;
    const minDist = a.radius + b.radius;

    if (distSq >= minDist * minDist) return null;

    const dist = Math.sqrt(distSq);

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
