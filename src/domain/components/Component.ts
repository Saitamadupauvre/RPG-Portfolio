export interface Component {
    readonly name: string;
    update?(dt: number): void;
}
