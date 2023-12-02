import { InterruptRequest } from './interrupt';

export interface Progress {
    /** An optional status message for the current progress. */
    status: string | null;
    /** Number between 0 and 1 that describes the current progress of the overall operation. */
    totalProgress: number;
    /** Number between 0 and 1 that describes the current progress of the status. */
    statusProgress: number;
}

export type ProgressListener = (progress: Readonly<Progress>) => void;
export type InterruptListener = (warning: Readonly<InterruptRequest>) => Promise<void>;

export interface ProgressMonitor {
    addProgressListener(listener: ProgressListener): void;
    addInterruptListener(listener: InterruptListener): void;
}

export interface ProgressToken {
    /**
     * Submits the current progress update to all listeners.
     *
     * If `status` changed from the last progress and there is no `statusProgress` given,
     * then `statusProgress` will be reset to 0.
     */
    submitProgress(progress: Partial<Readonly<Progress>>): void;

    /**
     * Submits an interruption that can optionally be displayed.
     */
    submitInterrupt(interrupt: Readonly<InterruptRequest>): Promise<void>;
}

const callListeners = <T>(listeners: Iterable<(value: T) => void>, value: T) => {
    for (const listener of listeners) {
        listener(value);
    }
};

export const updateProgress = (
    progress: Progress,
    { status, totalProgress, statusProgress }: Partial<Readonly<Progress>>,
): boolean => {
    let changed = false;

    if (totalProgress !== undefined && totalProgress !== progress.totalProgress) {
        // eslint-disable-next-line no-param-reassign
        progress.totalProgress = totalProgress;
        changed = true;
    }

    if (statusProgress !== undefined && statusProgress !== progress.statusProgress) {
        // eslint-disable-next-line no-param-reassign
        progress.statusProgress = statusProgress;
        changed = true;
    }

    if (status !== undefined && status !== progress.status) {
        // eslint-disable-next-line no-param-reassign
        progress.status = status;
        if (statusProgress === undefined) {
            // eslint-disable-next-line no-param-reassign
            progress.statusProgress = 0;
        }
        changed = true;
    }

    return changed;
};

export class ProgressController implements ProgressMonitor, ProgressToken {
    private readonly progressListeners: ProgressListener[] = [];

    private readonly interruptListeners: InterruptListener[] = [];

    private readonly progress: Progress;

    constructor() {
        this.progress = {
            status: null,
            totalProgress: 0,
            statusProgress: 0,
        };
    }

    addProgressListener(listener: ProgressListener): void {
        this.progressListeners.push(listener);
    }

    addInterruptListener(listener: InterruptListener): void {
        this.interruptListeners.push(listener);
    }

    submitProgress(update: Partial<Readonly<Progress>>): void {
        if (updateProgress(this.progress, update)) {
            callListeners(this.progressListeners, this.progress);
        }
    }

    async submitInterrupt(interrupt: Readonly<InterruptRequest>): Promise<void> {
        for (const listener of this.interruptListeners) {
            // eslint-disable-next-line no-await-in-loop
            await listener(interrupt);
        }
    }
}

export class SubProgress implements ProgressToken {
    constructor(
        private readonly token: ProgressToken,
        private readonly mapFn: (totalProgress: number) => number,
    ) {}

    static slice(token: ProgressToken, start = 0, end = 1) {
        return new SubProgress(token, (p) => start + p * (end - start));
    }

    submitProgress(progress: Partial<Readonly<Progress>>): void {
        if (progress.totalProgress !== undefined) {
            // eslint-disable-next-line no-param-reassign
            progress = { ...progress, totalProgress: this.mapFn(progress.totalProgress) };
        }
        this.token.submitProgress(progress);
    }

    submitInterrupt(interrupt: Readonly<InterruptRequest>): Promise<void> {
        return this.token.submitInterrupt(interrupt);
    }
}
