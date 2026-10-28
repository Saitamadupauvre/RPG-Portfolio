import * as THREE from 'three';
import { findFreePoint } from './navigation';
import { isNearObstacle } from './obstacles';
import { groundHeight } from './terrainField';

/** The gameplay lens. The menu shot uses a longer one, so the blend between them also zooms. */
export const GAME_FOV = 75;
/** Narrow, like a portrait lens: the knight fills the frame without the camera standing in their face. */
const MENU_FOV = 32;

/** Radians off the knight's nose: in front of them, a little to their left, so the face and the sword both show. */
const MENU_YAW = 0.6;
const MENU_DISTANCE = 8.5;
/** Eye height above the feet: just over the knight's head, so the horizon and the sky stay in frame. */
const MENU_EYE_HEIGHT = 2.2;
/** What the camera aims at above the feet: the chest, not the feet, or the knight sinks out of frame. */
const MENU_LOOK_HEIGHT = 1.1;
/**
 * How far the aim slides along the camera's left, on a landscape screen: the
 * knight then stands right of centre and the menu column keeps the left.
 */
const MENU_SHIFT = 1.9;
/** On a portrait screen the menu sits at the bottom: aim below the knight to lift them into the upper third. */
const MENU_DROP = 3.6;
/** And stand further back there, so the knight shrinks to fit above the title. */
const PORTRAIT_PULL_BACK = 1.8;
/** A slow drift round the knight, so the backdrop reads as live, not as a screenshot. */
const SWAY_ANGLE = 0.14;
const SWAY_PERIOD = 18;

/**
 * The way a knight placed at a bonfire faces: toward the gameplay camera, whose
 * offset is (6, 6, 6). Respawning, they then look at the player, not away.
 */
const SPAWN_FACING = Math.PI / 4;
/** How far right of the bonfire, as the menu camera sees it, the knight stands: beside the fire, never behind it. */
const SPAWN_SIDE = 1.7;
/** Yaw offsets tried in turn until the camera sees the knight clearly: the authored angle first, then further and further round. */
const YAW_TRIES = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3, Math.PI];
/** The camera keeps this far from a trunk, a rock or a statue: crowns spread much wider than the trunk circle. */
const EYE_MARGIN = 1.6;
/** And the line from the eye to the knight keeps this far from them. */
const LINE_MARGIN = 0.5;
/** Room the eye keeps above the ground under it. */
const EYE_CLEARANCE = 0.8;
/** The last stretch of the line, round the knight, is left untested: the bonfire beside them would block their own shot. */
const LINE_END_SKIP = 1;
const LINE_STEP = 0.25;

const UP = new THREE.Vector3(0, 1, 0);
const aim = new THREE.Vector3();
const left = new THREE.Vector3();
const eye = new THREE.Vector3();
const chest = new THREE.Vector3();
const sample = new THREE.Vector3();
const spawnFeet = new THREE.Vector3();

/** Where the menu camera stands for a knight at `feet`, `yaw` round them (sway included). */
function menuEye(feet: THREE.Vector3, yaw: number, landscape: boolean, out: THREE.Vector3): THREE.Vector3 {
    const distance = landscape ? MENU_DISTANCE : MENU_DISTANCE * PORTRAIT_PULL_BACK;
    return out.set(
        feet.x + Math.sin(yaw) * distance,
        feet.y + MENU_EYE_HEIGHT,
        feet.z + Math.cos(yaw) * distance,
    );
}

/**
 * Frames the knight for the menu: a close, low shot from in front. `yaw` is
 * the angle round the knight the shot was planned at (`pickMenuYaw`,
 * `planSpawn`): planned once, not taken from the facing every frame, so the
 * camera never swings into a tree because the knight turned. `feet` is the
 * ground point under the knight, `time` drives the sway.
 */
export function aimMenuShot(camera: THREE.PerspectiveCamera, feet: THREE.Vector3, yaw: number, time: number) {
    const landscape = camera.aspect >= 1;
    menuEye(feet, yaw + Math.sin((time / SWAY_PERIOD) * Math.PI * 2) * SWAY_ANGLE, landscape, camera.position);

    aim.set(feet.x, feet.y + MENU_LOOK_HEIGHT, feet.z);
    if (landscape) {
        // The camera's left, flattened: from the eye toward the knight, turned a quarter.
        left.subVectors(aim, camera.position).setY(0).normalize().cross(UP).negate();
        aim.addScaledVector(left, MENU_SHIFT);
    } else {
        aim.y -= MENU_DROP;
    }
    camera.lookAt(aim);
    setFov(camera, MENU_FOV);
}

/**
 * How well the menu camera at `yaw` sees a knight at `feet`, from 0 to 3: one
 * point per sway extreme and the middle where the eye stands in the open and
 * nothing (ground, trunk, crown, landmark) cuts the line to the chest.
 */
function shotScore(feet: THREE.Vector3, yaw: number, landscape: boolean): number {
    chest.set(feet.x, feet.y + MENU_LOOK_HEIGHT, feet.z);
    let score = 0;
    for (const sway of [-SWAY_ANGLE, 0, SWAY_ANGLE]) {
        menuEye(feet, yaw + sway, landscape, eye);
        if (isBlocked(eye, EYE_MARGIN, EYE_CLEARANCE)) continue;

        const length = eye.distanceTo(chest) - LINE_END_SKIP;
        let clear = true;
        for (let along = LINE_STEP; along < length && clear; along += LINE_STEP) {
            sample.lerpVectors(eye, chest, along / (length + LINE_END_SKIP));
            clear = !isBlocked(sample, LINE_MARGIN, 0);
        }
        if (clear) score++;
    }
    return score;
}

function isBlocked(point: THREE.Vector3, margin: number, clearance: number): boolean {
    const above = point.y - groundHeight(point.x, point.z);
    return above <= clearance || isNearObstacle(point.x, point.z, above, margin);
}

/** The menu angle round a knight already standing somewhere (quitting mid-run): the authored one, unless the view is blocked. */
export function pickMenuYaw(feet: THREE.Vector3, facing: number, aspect: number): number {
    let best = facing + MENU_YAW;
    let bestScore = -1;
    for (const offset of YAW_TRIES) {
        const yaw = facing + MENU_YAW + offset;
        const score = shotScore(feet, yaw, aspect >= 1);
        if (score > bestScore) {
            best = yaw;
            bestScore = score;
        }
        if (score === 3) break;
    }
    return best;
}

export type Spawn = { x: number; z: number; facing: number; menuYaw: number };

/**
 * Where a knight placed at the bonfire at (x, z) stands, faces, and is shot
 * from for the menu, chosen together: always on the right of the fire as the
 * menu camera sees it, so the flames never stand between the lens and them,
 * and the whole arrangement turned round the fire until the camera has a
 * clear view.
 */
export function planSpawn(bonfireX: number, bonfireZ: number, aspect: number): Spawn {
    let best: Spawn | null = null;
    let bestScore = -1;
    for (const offset of YAW_TRIES) {
        const facing = SPAWN_FACING + offset;
        const menuYaw = facing + MENU_YAW;
        // The menu camera's right, flattened: its forward (toward the knight) crossed with up.
        const [x, z] = findFreePoint(
            bonfireX + Math.cos(menuYaw) * SPAWN_SIDE,
            bonfireZ - Math.sin(menuYaw) * SPAWN_SIDE,
        );
        const score = shotScore(spawnFeet.set(x, groundHeight(x, z), z), menuYaw, aspect >= 1);
        if (score > bestScore) {
            best = { x, z, facing, menuYaw };
            bestScore = score;
        }
        if (score === 3) break;
    }
    // YAW_TRIES is never empty, so the loop always kept one.
    return best!;
}

/** Only touches the projection when the lens really changes: rebuilding it every frame is wasted work. */
export function setFov(camera: THREE.PerspectiveCamera, fov: number) {
    if (camera.fov === fov) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
}

/** Seconds a cut between the menu shot and the gameplay shot takes. */
const BLEND_SECONDS = 1.3;
/** Room the gliding camera keeps above the ground under it: the arc never dips into a hill. */
const GLIDE_CLEARANCE = 1;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const offset = new THREE.Vector3();
const look = new THREE.Vector3();
const forward = new THREE.Vector3();
const toOrbit = new THREE.Spherical();
const toLook = new THREE.Vector3();

/**
 * Glides the camera from where it stood to wherever its owner aims it each
 * frame. The target keeps moving (the player walks off as soon as the game
 * starts), so the blend never stores an end pose: every frame the owner aims
 * the camera at the live target first, then `apply` pulls it back toward the
 * captured start by what is left of the blend.
 *
 * Both poses are held as an orbit round the player (distance, two angles)
 * plus where the camera looks relative to them, and those are what blend.
 * Blending the position along a straight line and the rotation on its own
 * would cut low behind the knight, through hills and crowns, looking past
 * them halfway; an orbit swings round and up at a steady distance, aimed at
 * the knight all the way.
 */
export class CameraBlend {
    private fromOrbit = new THREE.Spherical();
    private fromLook = new THREE.Vector3();
    private fromFov = GAME_FOV;
    private elapsed = BLEND_SECONDS;

    /** Remember the pose the camera holds right now, round `pivot` (the player), as the start of a new glide. */
    public start(camera: THREE.PerspectiveCamera, pivot: THREE.Vector3) {
        this.fromOrbit.setFromVector3(offset.subVectors(camera.position, pivot));
        this.fromLook.subVectors(lookPoint(camera, pivot, look), pivot);
        this.fromFov = camera.fov;
        this.elapsed = 0;
    }

    /** Drop the glide in progress: the next aim stands as it is. */
    public stop() {
        this.elapsed = BLEND_SECONDS;
    }

    /** After the camera was aimed at this frame's target, round the same `pivot`. */
    public apply(camera: THREE.PerspectiveCamera, dt: number, pivot: THREE.Vector3) {
        if (this.elapsed >= BLEND_SECONDS) return;

        this.elapsed = Math.min(BLEND_SECONDS, this.elapsed + dt);
        const k = easeInOutCubic(this.elapsed / BLEND_SECONDS);

        toOrbit.setFromVector3(offset.subVectors(camera.position, pivot));
        toLook.subVectors(lookPoint(camera, pivot, look), pivot);

        const from = this.fromOrbit;
        // The short way round, or a half-turn apart could spin the long way.
        const turn = Math.atan2(Math.sin(toOrbit.theta - from.theta), Math.cos(toOrbit.theta - from.theta));
        toOrbit.set(
            THREE.MathUtils.lerp(from.radius, toOrbit.radius, k),
            THREE.MathUtils.lerp(from.phi, toOrbit.phi, k),
            from.theta + turn * k,
        );
        camera.position.setFromSpherical(toOrbit).add(pivot);
        camera.position.y = Math.max(camera.position.y, groundHeight(camera.position.x, camera.position.z) + GLIDE_CLEARANCE);

        camera.lookAt(look.lerpVectors(this.fromLook, toLook, k).add(pivot));
        setFov(camera, THREE.MathUtils.lerp(this.fromFov, camera.fov, k));
    }
}

/**
 * The point the camera aims at, recovered from its pose: straight ahead, as
 * far as the pivot. Exact for the gameplay shot (it looks at the player),
 * close enough for the menu shot, whose aim sits beside the knight.
 */
function lookPoint(camera: THREE.PerspectiveCamera, pivot: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    return out.copy(camera.position).addScaledVector(forward, camera.position.distanceTo(pivot));
}
