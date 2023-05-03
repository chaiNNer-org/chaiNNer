export enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
}

export const LEVEL_NAME = {
    [LogLevel.Error]: 'error',
    [LogLevel.Warn]: 'warn',
    [LogLevel.Info]: 'info',
    [LogLevel.Debug]: 'debug',
} as const;

export interface LogMessage {
    level: LogLevel;
    timestamp: number;
    message: unknown;
    additional: unknown[];
    stack?: string;
}

export interface LogTransport {
    level?: LogLevel;
    log(message: LogMessage): Promise<void> | void;
}

const transports: LogTransport[] = [];
const pendingTransports = new Set<Promise<void>>();
const callTransports = (message: LogMessage): void => {
    for (const transport of transports) {
        if (transport.level === undefined || message.level <= transport.level) {
            const result = transport.log(message);
            if (result instanceof Promise) {
                pendingTransports.add(result);
                result
                    .catch((e) => {
                        // we are the logger, so what do we do when logging fails?
                        // eslint-disable-next-line no-console
                        console.error(e);
                    })
                    .finally(() => {
                        pendingTransports.delete(result);
                    });
            }
        }
    }
};

const logInternal = (level: LogLevel, message: unknown, ...additional: unknown[]): void => {
    const timestamp = Date.now();
    const stack = new Error().stack?.replace(/^(?:[^\n]*\n){2}/, '');
    const logMessage: LogMessage = { level, message, additional, timestamp, stack };
    callTransports(logMessage);
};

export const log = {
    error: logInternal.bind(null, LogLevel.Error),
    warn: logInternal.bind(null, LogLevel.Warn),
    info: logInternal.bind(null, LogLevel.Info),
    debug: logInternal.bind(null, LogLevel.Debug),
    addTransport: (...transport: LogTransport[]): void => {
        transports.push(...transport);
    },
    /**
     * Waits until all loggers have finished logging.
     */
    flush: async (): Promise<void> => {
        await Promise.all(pendingTransports);
    },
} as const;
