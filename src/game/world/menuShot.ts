import * as THREE from 'three';

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

const UP = new THREE.Vector3(0, 1, 0);
const aim = new THREE.Vector3();
const left = new THREE.Vector3();

/**
 * Frames the knight for the menu: a close, low shot from in front, relative to
 * the way they face, so quitting back to the menu mid-game still shows their
 * face rather than their back.
 *
 * `feet` is the ground point under the knight, `facing` their rotation.y
 * (0 looks along +Z), `time` drives the sway.
 */
export function aimMenuShot(camera: THREE.PerspectiveCamera, feet: THREE.Vector3, facing: number, time: number) {
    const landscape = camera.aspect >= 1;
    const distance = landscape ? MENU_DISTANCE : MENU_DISTANCE * PORTRAIT_PULL_BACK;
    const yaw = facing + MENU_YAW + Math.sin((time / SWAY_PERIOD) * Math.PI * 2) * SWAY_ANGLE;
    camera.position.set(
        feet.x + Math.sin(yaw) * distance,
        feet.y + MENU_EYE_HEIGHT,
        feet.z + Math.cos(yaw) * distance,
    );

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

/** Only touches the projection when the lens really changes: rebuilding it every frame is wasted work. */
export function setFov(camera: THREE.PerspectiveCamera, fov: number) {
    if (camera.fov === fov) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
}

/** Seconds a cut between the menu shot and the gameplay shot takes. */
const BLEND_SECONDS = 1.3;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Glides the camera from where it stood to wherever its owner aims it each
 * frame. The target keeps moving (the player walks off as soon as the game
 * starts), so the blend never stores an end pose: every frame the owner aims
 * the camera at the live target first, then `apply` pulls it back toward the
 * captured start by what is left of the blend.
 */
export class CameraBlend {
    private fromPosition = new THREE.Vector3();
    private fromQuaternion = new THREE.Quaternion();
    private fromFov = GAME_FOV;
    private elapsed = BLEND_SECONDS;

    /** Remember the pose the camera holds right now as the start of a new glide. */
    public start(camera: THREE.PerspectiveCamera) {
        this.fromPosition.copy(camera.position);
        this.fromQuaternion.copy(camera.quaternion);
        this.fromFov = camera.fov;
        this.elapsed = 0;
    }

    /** After the camera was aimed at this frame's target. */
    public apply(camera: THREE.PerspectiveCamera, dt: number) {
        if (this.elapsed >= BLEND_SECONDS) return;

        this.elapsed = Math.min(BLEND_SECONDS, this.elapsed + dt);
        const k = easeInOutCubic(this.elapsed / BLEND_SECONDS);

        camera.position.lerpVectors(this.fromPosition, camera.position, k);
        camera.quaternion.slerpQuaternions(this.fromQuaternion, camera.quaternion, k);
        setFov(camera, THREE.MathUtils.lerp(this.fromFov, camera.fov, k));
    }
}
