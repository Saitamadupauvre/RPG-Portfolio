type Listener<Args extends unknown[]> = (...args: Args) => void;
type ListenerList<K extends keyof Events, Events extends Record<string, unknown[]>> = Listener<Events[K]>[];

export class EventEmitter<Events extends Record<string, unknown[]>> {
    private listeners: { [K in keyof Events]?: ListenerList<K, Events> } = {};

    public on<K extends keyof Events>(event: K, callback: Listener<Events[K]>): () => void {
        (this.listeners[event] ??= []).push(callback);
        return () => this.off(event, callback);
    }

    public once<K extends keyof Events>(event: K, callback: Listener<Events[K]>): () => void {
        const wrapped = ((...args: Events[K]) => {
            this.off(event, wrapped);
            callback(...args);
        }) as Listener<Events[K]>;
        return this.on(event, wrapped);
    }

    public off<K extends keyof Events>(event: K, callback: Listener<Events[K]>) {
        const callbacks = this.listeners[event];
        if (!callbacks) return;
        this.listeners[event] = callbacks.filter(cb => cb !== callback) as ListenerList<K, Events>;
    }

    public emit<K extends keyof Events>(event: K, ...args: Events[K]) {
        const callbacks = this.listeners[event];
        if (!callbacks) return;
        for (const callback of [...callbacks]) callback(...args);
    }
}
