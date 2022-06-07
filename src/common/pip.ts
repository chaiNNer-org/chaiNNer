/* eslint-disable no-continue */
/* eslint-disable no-param-reassign */
import { spawn } from 'child_process';
import log from 'electron-log';
import * as pty from 'node-pty-prebuilt-multiarch';
import { Dependency } from './dependencies';
import { getPythonInfo } from './python';
import { noop } from './util';

export interface OnStdio {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    dynamicUpdates?: boolean;
}

const handleDynamicUpdates = (on: (data: string) => void): ((data: string) => void) => {
    let lastLine = '';
    let writeIndex = 0;
    return (data) => {
        for (const token of data.split(/([\r\n])/)) {
            if (token === '\n') {
                on(`${lastLine}\n`);
                lastLine = '';
                writeIndex = 0;
            } else if (token === '\r') {
                writeIndex = 0;
            } else {
                const prefix = lastLine.slice(0, writeIndex);
                const suffix = lastLine.slice(writeIndex + token.length);
                lastLine = prefix + token + suffix;
                writeIndex = prefix.length + token.length;
            }
        }
    };
};

const enableDynamicUpdates = ({ onStdout, onStderr, dynamicUpdates }: OnStdio): OnStdio => {
    if (dynamicUpdates) return { onStdout, onStderr, dynamicUpdates: true };

    return {
        onStdout: onStdout === undefined ? undefined : handleDynamicUpdates(onStdout),
        onStderr: onStderr === undefined ? undefined : handleDynamicUpdates(onStderr),
        dynamicUpdates: true,
    };
};

const chain = (a: OnStdio, b: OnStdio): OnStdio => {
    if (b.dynamicUpdates && !a.dynamicUpdates) a = enableDynamicUpdates(a);
    if (a.dynamicUpdates && !b.dynamicUpdates) b = enableDynamicUpdates(b);

    return {
        onStdout: (data) => {
            a.onStdout?.(data);
            b.onStdout?.(data);
        },
        onStderr: (data) => {
            a.onStderr?.(data);
            b.onStderr?.(data);
        },
        dynamicUpdates: !!a.dynamicUpdates,
    };
};

export const runPip = async (args: readonly string[], onStdio: OnStdio = {}): Promise<string> => {
    const { onStdout = noop, onStderr = (data) => log.error(data), dynamicUpdates } = onStdio;

    const { python } = await getPythonInfo();

    // defensive copy in case the args array is changed
    args = ['-m', 'pip', ...args, '--disable-pip-version-check'];

    log.info(`Python executable: ${python}`);
    log.info(`Running pip command: ${args.slice(1).join(' ')}`);

    if (dynamicUpdates) {
        return new Promise<string>((resolve, reject) => {
            log.debug(`Using PTY`);

            const child = pty.spawn(python, args.slice(), { cols: 10000 });

            let stdout = '';
            const appendStdout = handleDynamicUpdates((data) => {
                stdout += data;
            });

            child.onData((data) => {
                appendStdout(data);
                onStdout(data);
            });
            child.onExit(({ exitCode }) => {
                if (exitCode === 0) {
                    resolve(stdout);
                } else {
                    const message = `Pip process exited with non-zero exit code ${String(
                        exitCode
                    )}`;
                    log.warn(message);
                    reject(new Error(message));
                }
            });
        });
    }

    return new Promise<string>((resolve, reject) => {
        const child = spawn(python, args);

        let stdout = '';

        child.stdout.on('data', (data) => {
            const str = String(data);
            stdout += str;
            onStdout(str);
        });

        child.stderr.on('data', (data) => {
            onStderr(String(data));
        });

        child.on('error', (error) => {
            log.warn(`Pip process errored: ${String(error)}`);
            reject(error);
        });
        child.on('exit', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                const message = `Pip process exited with non-zero exit code ${String(code)}`;
                log.warn(message);
                reject(new Error(message));
            }
        });
    });
};

export type PipList = { [packageName: string]: string };

export const runPipList = async (onStdio?: OnStdio): Promise<PipList> => {
    const output = await runPip(['list', '--format=json'], onStdio);

    interface ListEntry {
        name: string;
        version: string;
    }
    const list = JSON.parse(output) as ListEntry[];

    return Object.fromEntries(list.map((e) => [e.name, e.version]));
};

export const runPipInstall = async (
    dependencies: readonly Dependency[],
    onProgress?: (percentage: number) => void,
    onStdio: OnStdio = {}
): Promise<void> => {
    onProgress?.(0);

    const packages = dependencies.flatMap((d) => d.packages);
    const deps = packages.map((p) => `${p.packageName}==${p.version}`);

    const toInstall = new Set(packages.map((p) => p.packageName));
    let downloaded = 0;
    interface CurrentDownload {
        packageName: string;
        ratio: number;
    }
    let currentDownload: CurrentDownload | undefined;

    const onStdout = (data: string) => {
        const tokens = data.split(/[\r\n]/).filter(Boolean);
        for (const token of tokens) {
            /**
             * The lines we're looking for either look like this:
             *
             * ```
             * "Requirement already satisfied: numpy>=1.18.5 in ...\n"
             * ```
             *
             * ```
             * "Collecting pandas\r\n"
             * "  Downloading pandas-1.4.2-cp39-cp39-win_amd64.whl (10.5 MB)\r\n"
             * "     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.0/10.5 MB ? eta -:--:--"
             * "\r     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.1/10.5 MB 1.1 MB/s eta 0:00:10"
             * "\r     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0.1/10.5 MB 1.2 MB/s eta 0:00:09"
             * "\r     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 10.5/10.5 MB 1.4 MB/s eta 0:00:00\r\n"
             * ```
             *
             * ```
             * "Installing collected packages: python-dateutil, pandas\r\n"
             * ```
             */
            let m = / (\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?) .*\beta\b/.exec(token);
            if (m) {
                if (currentDownload) {
                    const [, current, total] = m;
                    currentDownload.ratio = Number(current) / Number(total);
                }
                continue;
            }
            if (token.includes('Downloading')) continue;

            if (currentDownload) {
                currentDownload = undefined;
                downloaded += 1;
            }

            m = /Collecting ([^\s<>=^]+)/.exec(token);
            if (m) {
                const p = m[1];
                if (toInstall.has(p)) {
                    currentDownload = {
                        packageName: p,
                        ratio: 0,
                    };
                }
            }

            m = /Requirement already satisfied: ([^\s<>=^]+)/.exec(token);
            if (m) {
                if (toInstall.has(m[1])) downloaded += 1;
            }
        }
        onProgress?.(((downloaded + (currentDownload?.ratio ?? 0)) / toInstall.size) * 90);
    };

    await runPip(
        ['install', '--upgrade', ...deps],
        onProgress ? chain({ onStdout, dynamicUpdates: true }, onStdio) : onStdio
    );

    onProgress?.(100);
};

export const runPipUninstall = async (
    dependencies: readonly Dependency[],
    onProgress?: (percentage: number) => void,
    onStdio: OnStdio = {}
): Promise<void> => {
    const startPercentage = 10;
    onProgress?.(startPercentage);

    const deps = dependencies.map((d) => d.packages.map((p) => p.packageName)).flat();

    let uninstalledPackages = 0;
    const onStdout = (data: string) => {
        const lines = data.split(/\r?\n/);
        for (const line of lines) {
            /**
             * The lines we're looking for either look like this:
             *
             * ```
             * Found existing installation: pandas 1.4.2
             * Uninstalling pandas-1.4.2:
             *   Successfully uninstalled pandas-1.4.2
             * ```
             *
             * or like this:
             *
             * ```
             * WARNING: Skipping pandas as it is not installed.
             * ```
             */
            if (/WARNING: Skipping/.test(line)) {
                uninstalledPackages += 1;
            } else if (/Successfully uninstalled/.test(line)) {
                uninstalledPackages += 1;
            }
        }
        onProgress?.(
            startPercentage + (uninstalledPackages / deps.length) * (100 - startPercentage)
        );
    };

    await runPip(['uninstall', '-y', ...deps], onProgress ? chain({ onStdout }, onStdio) : onStdio);
    onProgress?.(100);
};

export const upgradePip = async (onStdio?: OnStdio) => {
    await runPip(['install', '--upgrade', 'pip', '--no-warn-script-location'], onStdio);
};
