import type { Component } from '../../../domain/components/Component';
import type { XraySilhouette } from '../../render/xraySilhouette';

/** Shows its owner's x-ray silhouette only while `isShown` holds (an enemy hunting the player). */
export class XrayComponent implements Component {
    public readonly name = 'xray';

    private silhouette: XraySilhouette;
    private isShown: () => boolean;

    constructor(silhouette: XraySilhouette, isShown: () => boolean) {
        this.silhouette = silhouette;
        this.isShown = isShown;
    }

    /** Gives meshes added since (a model that just loaded) their silhouette. */
    public refresh() {
        this.silhouette.refresh();
    }

    /** Off until the next `update` decides again: for frames where enemies do not update (the menu). */
    public hide() {
        this.silhouette.setEnabled(false);
    }

    public update() {
        this.silhouette.setEnabled(this.isShown());
    }
}
