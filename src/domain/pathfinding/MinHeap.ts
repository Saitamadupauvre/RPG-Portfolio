/**
 * Binary min-heap keyed by a number. A* asks "which open node is cheapest?"
 * once per expansion; scanning a list answers in O(n), a heap in O(log n).
 */
export class MinHeap<T> {
    private items: T[] = [];
    private scoreOf: (item: T) => number;

    constructor(scoreOf: (item: T) => number) {
        this.scoreOf = scoreOf;
    }

    public get size(): number {
        return this.items.length;
    }

    public push(item: T) {
        this.items.push(item);
        this.bubbleUp(this.items.length - 1);
    }

    public pop(): T | undefined {
        const top = this.items[0];
        const last = this.items.pop();
        if (this.items.length > 0 && last !== undefined) {
            this.items[0] = last;
            this.sinkDown(0);
        }
        return top;
    }

    private bubbleUp(index: number) {
        const item = this.items[index];
        const score = this.scoreOf(item);

        while (index > 0) {
            const parentIndex = (index - 1) >> 1;
            const parent = this.items[parentIndex];
            if (score >= this.scoreOf(parent)) break;

            this.items[index] = parent;
            index = parentIndex;
        }
        this.items[index] = item;
    }

    private sinkDown(index: number) {
        const length = this.items.length;
        const item = this.items[index];
        const score = this.scoreOf(item);

        while (true) {
            const left = index * 2 + 1;
            const right = left + 1;
            let smallest = index;
            let smallestScore = score;

            if (left < length && this.scoreOf(this.items[left]) < smallestScore) {
                smallest = left;
                smallestScore = this.scoreOf(this.items[left]);
            }
            if (right < length && this.scoreOf(this.items[right]) < smallestScore) {
                smallest = right;
            }
            if (smallest === index) break;

            this.items[index] = this.items[smallest];
            index = smallest;
        }
        this.items[index] = item;
    }
}
