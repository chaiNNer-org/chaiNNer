/* eslint-disable no-param-reassign */
import { spawn } from 'child_process';
import { PythonInfo, Version } from './common-types';
import { Dependency } from './dependencies';
import { sanitizedEnv } from './env';
import { log } from './log';
import { pipInstallWithProgress } from './pipInstallWithProgress';
import { noop } from './util';

export interface OnStdio {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
}

export const runPip = async (
    { python }: PythonInfo,
    args: readonly string[],
    onStdio: OnStdio = {}
): Promise<string> => {
    const { onStdout = noop, onStderr = (data) => log.error(data) } = onStdio;

    // defensive copy in case the args array is changed
    args = ['-m', 'pip', ...args, '--disable-pip-version-check'];

    return new Promise<string>((resolve, reject) => {
        log.info(`Python executable: ${python}`);
        log.info(`Running pip command: ${args.slice(1).join(' ')}`);

        const child = spawn(python, args, {
            env: sanitizedEnv,
        });

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

export type PipList = { [packageName: string]: Version | undefined };

export const runPipList = async (info: PythonInfo, onStdio?: OnStdio): Promise<PipList> => {
    const output = await runPip(info, ['list', '--format=json'], onStdio);

    interface ListEntry {
        name: string;
        version: Version;
    }
    const list = JSON.parse(output) as ListEntry[];

    return Object.fromEntries(list.map((e) => [e.name, e.version]));
};

const getFindLinks = (dependencies: readonly Dependency[]): string[] => {
    const links = new Set<string>();
    for (const d of dependencies) {
        for (const p of d.dependencies) {
            if (p.findLink) {
                links.add(p.findLink);
            }
        }
    }
    return [...links];
};

export const runPipInstall = async (
    info: PythonInfo,
    dependencies: readonly Dependency[],
    onProgress?: (percentage: number) => void,
    onStdio?: OnStdio
): Promise<void> => {
    onProgress?.(0);
    if (onProgress === undefined) {
        // TODO: implement progress via this method (if possible)
        const deps = dependencies
            .map((d) => d.dependencies.map((p) => `${p.packageName}==${p.version}`))
            .flat();
        const findLinks = getFindLinks(dependencies).flatMap((l) => ['--extra-index-url', l]);

        await runPip(info, ['install', '--upgrade', ...deps, ...findLinks], onStdio);
    } else {
        const { python } = info;
        for (const dep of dependencies) {
            for (const pkg of dep.dependencies) {
                // eslint-disable-next-line no-await-in-loop
                await pipInstallWithProgress(python, pkg, onProgress, onStdio);
            }
        }
    }
    onProgress?.(100);
};

export const runPipUninstall = async (
    info: PythonInfo,
    dependencies: readonly Dependency[],
    onProgress?: (percentage: number) => void,
    onStdio?: OnStdio
): Promise<void> => {
    onProgress?.(10);
    const deps = dependencies.map((d) => d.dependencies.map((p) => p.packageName)).flat();
    onProgress?.(25);
    await runPip(info, ['uninstall', '-y', ...deps], onStdio);
    onProgress?.(100);
};
