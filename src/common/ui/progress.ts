import { InterruptRequest } from './interrupt';

export interface Progress<S> {
    stage: S;
    /** Number between 0 and 1 that describes the current progress of the overall operation. */
    totalProgress: number;
    /** Number between 0 and 1 that describes the current progress of the state. */
    stageProgress: number;
}

export type ProgressListener<S> = (progress: Readonly<Progress<S>>) => void;
export type InterruptListener = (warning: Readonly<InterruptRequest>) => Promise<void>;

export interface ProgressMonitor<S> {
    addProgressListener(listener: ProgressListener<S>): void;
    addInterruptListener(listener: InterruptListener): void;
}

export interface ProgressToken<S> {
    /**
     * Submits the current progress update to all listeners.
     *
     * If `stage` changed from the last progress and there is no `stageProgress` given,
     * then `stageProgress` will be reset to 0.
     */
    submitProgress(progress: Partial<Readonly<Progress<S>>>): void;

    /**
     * Submits an interruption that can optionally be displayed.
     */
    submitInterrupt(interrupt: Readonly<InterruptRequest>): Promise<void>;
}

/**
 * Returns the state type of some progress-related object.
 */
export type StageOf<T> = T extends Progress<infer S>
    ? S
    : T extends ProgressMonitor<infer S>
    ? S
    : T extends ProgressToken<infer S>
    ? S
    : never;

const callListeners = <T>(listeners: Iterable<(value: T) => void>, value: T) => {
    for (const listener of listeners) {
        listener(value);
    }
};

export const updateProgress = <S>(
    progress: Progress<S>,
    { stage, totalProgress, stageProgress }: Partial<Readonly<Progress<S>>>
): boolean => {
    let changed = false;

    if (totalProgress !== undefined && totalProgress !== progress.totalProgress) {
        // eslint-disable-next-line no-param-reassign
        progress.totalProgress = totalProgress;
        changed = true;
    }

    if (stageProgress !== undefined && stageProgress !== progress.stageProgress) {
        // eslint-disable-next-line no-param-reassign
        progress.stageProgress = stageProgress;
        changed = true;
    }

    if (stage !== undefined && stage !== progress.stage) {
        // eslint-disable-next-line no-param-reassign
        progress.stage = stage;
        if (stageProgress === undefined) {
            // eslint-disable-next-line no-param-reassign
            progress.stageProgress = 0;
        }
        changed = true;
    }

    return changed;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export class ProgressController<S extends {}> implements ProgressMonitor<S>, ProgressToken<S> {
    private readonly progressListeners: ProgressListener<S>[] = [];

    private readonly interruptListeners: InterruptListener[] = [];

    private readonly progress: Progress<S>;

    constructor(initialStage: S) {
        this.progress = {
            stage: initialStage,
            totalProgress: 0,
            stageProgress: 0,
        };
    }

    addProgressListener(listener: ProgressListener<S>): void {
        this.progressListeners.push(listener);
    }

    addInterruptListener(listener: InterruptListener): void {
        this.interruptListeners.push(listener);
    }

    submitProgress(update: Partial<Readonly<Progress<S>>>): void {
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

export class SubProgress<S> implements ProgressToken<S> {
    constructor(
        private readonly token: ProgressToken<S>,
        private readonly mapFn: (totalProgress: number) => number
    ) {}

    static slice<S>(token: ProgressToken<S>, start = 0, end = 1) {
        return new SubProgress(token, (p) => start + p * (end - start));
    }

    submitProgress(progress: Partial<Readonly<Progress<S>>>): void {
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
