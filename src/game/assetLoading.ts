import * as THREE from 'three';

export type AssetWatch = {
    /**
     * Resolves once every file started so far has finished (or failed), or
     * after `timeoutMs` at most: a slow model must not hold the game hostage.
     */
    settled(onProgress: (ratio: number) => void, timeoutMs: number): Promise<void>;
};

/**
 * Follows the files three.js loads through its default manager: every glTF
 * model and its textures, since `loadModel`'s loader is built without a
 * manager of its own. Must start before the world is built, because building
 * it is what requests them.
 *
 * The manager only reports a total as files *finish*, and more can be queued
 * meanwhile, so the ratio can dip; the loading bar keeps the highest value.
 */
export function watchAssets(): AssetWatch {
    const manager = THREE.DefaultLoadingManager;
    let busy = false;
    let report: ((ratio: number) => void) | null = null;
    let finish: (() => void) | null = null;

    manager.onStart = () => {
        busy = true;
    };
    manager.onProgress = (_url, loaded, total) => {
        report?.(total > 0 ? loaded / total : 1);
    };
    manager.onLoad = () => {
        busy = false;
        finish?.();
    };

    return {
        settled(onProgress, timeoutMs) {
            if (!busy) return Promise.resolve();
            report = onProgress;

            return new Promise((resolve) => {
                const done = () => {
                    window.clearTimeout(timer);
                    // Later loads (chunks streaming in) are none of the loading screen's business.
                    report = null;
                    finish = null;
                    resolve();
                };
                const timer = window.setTimeout(done, timeoutMs);
                finish = done;
            });
        },
    };
}
