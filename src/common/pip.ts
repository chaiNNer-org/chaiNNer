/* eslint-disable no-param-reassign */
import { spawn } from 'child_process';
import { PyPiPackage, PythonInfo } from './common-types';
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

const getFindLinks = (dependencies: readonly PyPiPackage[]): string[] => {
    const links = new Set<string>();
    for (const p of dependencies) {
        if (p.findLink) {
            links.add(p.findLink);
        }
    }
    return [...links];
};

export const runPipInstall = async (
    info: PythonInfo,
    dependencies: readonly PyPiPackage[],
    onProgress?: (percentage: number) => void,
    onStdio?: OnStdio
): Promise<void> => {
    onProgress?.(0);
    if (onProgress === undefined) {
        // TODO: implement progress via this method (if possible)
        const deps = dependencies.map((p) => `${p.pypiName}==${p.version}`);
        const findLinks = getFindLinks(dependencies).flatMap((l) => ['--extra-index-url', l]);

        await runPip(info, ['install', '--upgrade', ...deps, ...findLinks], onStdio);
    } else {
        const { python } = info;
        for (const pkg of dependencies) {
            // eslint-disable-next-line no-await-in-loop
            await pipInstallWithProgress(python, pkg, onProgress, onStdio);
        }
    }
    onProgress?.(100);
};

export const runPipUninstall = async (
    info: PythonInfo,
    dependencies: readonly PyPiPackage[],
    onProgress?: (percentage: number) => void,
    onStdio?: OnStdio
): Promise<void> => {
    onProgress?.(10);
    const deps = dependencies.map((p) => p.pypiName);
    onProgress?.(25);
    await runPip(info, ['uninstall', '-y', ...deps], onStdio);
    onProgress?.(100);
};
