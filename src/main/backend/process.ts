import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { app } from 'electron/main';
import { existsSync } from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import { Readable } from 'stream';
import { getBackend } from '../../common/Backend';
import { PythonInfo } from '../../common/common-types';
import { log } from '../../common/log';
import { delay, lazy } from '../../common/util';
import { sanitizedEnv } from '../env';

const getBackendPath = lazy((): string => {
    const candidates: string[] = [
        path.join(process.resourcesPath, 'src', 'run.py'),
        path.join(app.getAppPath(), '..', 'src', 'run.py'),
        './backend/src/run.py',
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    log.error('Unable to find backend path from the following candidates:', candidates);
    throw new Error('Unable to find backend path');
});

// e.g. "[12:34:56] [1234] [INFO] message"
const BACKEND_LOG_LINE = /^\s*\[[^[\]]*\] \[\d*\] \[(\w+)\] (.*)$/;

/**
 * Logs the output of the backend process line by line.
 *
 * The backend writes DEBUG and INFO records to its own log files, so those are dropped here.
 * Warnings, errors, and anything that isn't a log record (tracebacks, startup errors,
 * `print`s) are logged.
 */
const logBackendOutput = (stream: Readable, unformattedLevel: 'info' | 'error') => {
    createInterface({ input: stream, crlfDelay: Infinity }).on('line', (line) => {
        const match = BACKEND_LOG_LINE.exec(line);
        if (!match) {
            if (line.trim()) {
                log[unformattedLevel](`Backend: ${line}`);
            }
            return;
        }

        const [, level, message] = match;
        switch (level) {
            case 'DEBUG':
            case 'INFO':
                break;
            case 'WARNING':
                log.warn(`Backend: ${message}`);
                break;
            case 'ERROR':
            case 'CRITICAL':
                log.error(`Backend: ${message}`);
                break;
            default:
                log[unformattedLevel](`Backend: ${message}`);
                break;
        }
    });
};

interface BaseBackendProcess {
    readonly owned: boolean;
    readonly url: string;
    readonly python: PythonInfo;
}

type Env = Readonly<Partial<Record<string, string>>>;

type ErrorListener = (error: Error) => void;

export interface SpawnOptions {
    port: number;
    python: PythonInfo;
    storageDir?: string;
    logsDir?: string;
    env?: Env;
}

export class OwnedBackendProcess implements BaseBackendProcess {
    readonly owned = true;

    get url(): string {
        return `http://127.0.0.1:${this.options.port}`;
    }

    get python(): PythonInfo {
        return this.options.python;
    }

    private readonly options: SpawnOptions;

    private process?: ChildProcessWithoutNullStreams;

    private errorListeners: ErrorListener[] = [];

    private constructor(options: SpawnOptions, process: ChildProcessWithoutNullStreams) {
        this.options = options;
        this.setNewProcess(process);
    }

    static spawn(options: Readonly<SpawnOptions>): OwnedBackendProcess {
        // defensive copy
        // eslint-disable-next-line no-param-reassign
        options = {
            ...options,
            env: options.env ? { ...options.env } : undefined,
        };

        const backend = OwnedBackendProcess.spawnProcess(options);
        return new OwnedBackendProcess(options, backend);
    }

    private static spawnProcess(options: SpawnOptions): ChildProcessWithoutNullStreams {
        log.info('Attempting to spawn backend...');

        const args: string[] = [
            // path to run.py
            getBackendPath(),
            // port the server will run on
            String(options.port),
        ];

        if (options.storageDir) {
            args.push('--storage-dir', options.storageDir);
        }

        if (options.logsDir) {
            args.push('--logs-dir', options.logsDir);
        }

        const backend = spawn(options.python.python, args, {
            env: {
                ...sanitizedEnv,
                PYTHONIOENCODING: 'utf-8',
                ...options.env,
            },
        });

        // The pipes must always be read. Otherwise the backend blocks once they fill up.
        logBackendOutput(backend.stdout, 'info');
        logBackendOutput(backend.stderr, 'error');

        return backend;
    }

    addErrorListener(listener: ErrorListener) {
        this.errorListeners.push(listener);
    }

    clearErrorListeners() {
        this.errorListeners = [];
    }

    private setNewProcess(process: ChildProcessWithoutNullStreams): void {
        this.process = process;

        process.on('error', (error) => {
            log.error(`Python subprocess encountered an unexpected error: ${String(error)}`);

            for (const listener of this.errorListeners) {
                listener(error);
            }
        });
        process.on('exit', (code, signal) => {
            log.error(
                `Python subprocess exited with code ${String(code)} and signal ${String(signal)}`
            );

            if (this.process === process) {
                // reset process
                this.process = undefined;
            }
        });
    }

    /**
     * Kills the current backend process.
     *
     * @throws If the backend process couldn't exit
     */
    async kill() {
        log.info('Attempting to kill backend...');

        if (!this.process) {
            // No process to kill
            log.warn('Process has already been killed');
            return;
        }
        if (this.process.exitCode !== null) {
            // process was killed by something on the outside and we missed it
            log.warn('Process has already been killed');
            this.process = undefined;
            return;
        }

        await getBackend(this.url).shutdown();
        if (this.process.kill()) {
            this.process = undefined;
            log.info('Successfully killed backend.');
        }
    }

    /**
     * Tries to kill the backend.
     *
     * This function is guaranteed to throw no errors, it will only log errors if any occur.
     */
    async tryKill() {
        try {
            await this.kill();
        } catch (error) {
            log.error('Error killing backend.', error);
        }
    }

    async restart() {
        await this.tryKill();

        const backend = OwnedBackendProcess.spawnProcess(this.options);
        this.setNewProcess(backend);
    }
}

export class BorrowedBackendProcess implements BaseBackendProcess {
    readonly owned = false;

    readonly url: string;

    readonly python: PythonInfo;

    private constructor(url: string, python: PythonInfo) {
        this.url = url;
        this.python = python;
    }

    static async fromUrl(url: string): Promise<BorrowedBackendProcess> {
        const backend = getBackend(url);
        let python: PythonInfo | undefined;
        // try a few times to get python info, in case backend is still starting up
        const maxTries = 50;
        const startSleep = 1;
        const maxSleep = 250;

        for (let i = 0; i < maxTries; i += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop
                python = await backend.pythonInfo();
            } catch {
                // eslint-disable-next-line no-await-in-loop
                await delay(Math.max(maxSleep, startSleep * 2 ** i));
            }
        }
        if (!python) {
            throw new Error('Unable to get python info from backend');
        }
        return new BorrowedBackendProcess(url, python);
    }
}

export type BackendProcess = OwnedBackendProcess | BorrowedBackendProcess;
