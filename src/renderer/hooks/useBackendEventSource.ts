import {
    EventSourceEvent,
    EventSourceStatus,
    useEventSource,
    useEventSourceListener,
} from '@react-nano/use-event-source';
import log from 'electron-log';
import { BackendExceptionSource } from '../../common/Backend';
import { OutputData } from '../../common/common-types';

export type BackendEventSource = EventSource & { readonly __backend?: never };

export const useBackendEventSource = (
    port: number
): readonly [BackendEventSource | null, EventSourceStatus] => {
    return useEventSource(`http://localhost:${port}/sse`, true);
};

export interface BackendEventMap {
    finish: { message: string };
    'execution-error': {
        message: string;
        source?: BackendExceptionSource | null;
        exception: string;
    };
    'node-finish': {
        finished: string[];
        nodeId: string;
        executionTime?: number | null;
        data?: OutputData | null;
        progressPercent?: number | null;
    };
    'iterator-progress-update': { percent: number; iteratorId: string; running?: string[] | null };
}

export type BackendEventSourceListener<T extends keyof BackendEventMap> = (
    e: BackendEventMap[T] | undefined,
    event: EventSourceEvent
) => void;

export const useBackendEventSourceListener = <T extends keyof BackendEventMap>(
    source: BackendEventSource | null,
    type: T,
    listener: BackendEventSourceListener<T>
): void => {
    useEventSourceListener(
        source,
        [type],
        (event) => {
            let parsed: BackendEventMap[T] | undefined;
            try {
                parsed = JSON.parse(event.data) as BackendEventMap[T];
            } catch (error) {
                log.error(`The response data for event ${type} was invalid JSON: `, error);
            }

            try {
                listener(parsed, event);
            } catch (error) {
                log.error(
                    `Listener for event ${type} and data ${
                        parsed === undefined ? 'undefined' : JSON.stringify(parsed)
                    } errored: `,
                    error
                );
            }
        },
        [source, type, listener]
    );
};
