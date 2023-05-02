// Borrowed and modified from https://github.com/sebhildebrandt/systeminformation/blob/master/lib/graphics.js
// Changed to be asynchronous to avoid blocking

import { exec as _exec, spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import util from 'util';
import { log } from '../common/log';
import { lazy } from '../common/util';

const exec = util.promisify(_exec);

const platform = os.platform();

// Best approximation of what drive windows is installed on
const homePath = os.homedir();
const WINDIR = homePath ? `${homePath.charAt(0)}:\\Windows` : 'C:\\Windows';

const asyncFilter = async <T>(arr: readonly T[], predicate: (item: T) => PromiseLike<boolean>) =>
    Promise.all(arr.map(predicate)).then((results) => arr.filter((_v, index) => results[index]));

const hasOutput = (command: string): Promise<boolean> => {
    return exec(command).then(
        ({ stdout }) => stdout.trim().length > 0,
        () => false
    );
};

const getNvidiaSmiCommandFromPath = async (): Promise<string | undefined> => {
    if (await hasOutput(`${platform === 'win32' ? 'where' : 'which'} nvidia-smi`)) {
        return 'nvidia-smi';
    }
    if (await hasOutput('nvidia-smi')) {
        return 'nvidia-smi';
    }
    return undefined;
};

const hasNvidiaGpu = () => {
    return exec('wmic path win32_VideoController get name')
        .then(({ stdout }) => {
            const lower = stdout.toLowerCase();
            const checks = ['geforce', 'nvidia', 'gtx', 'rtx', 'quadro'];
            return checks.some((keyword) => lower.includes(keyword));
        })
        .catch(() => false);
};

const getNvidiaSmiCommand = async (): Promise<string | undefined> => {
    const fromPath = await getNvidiaSmiCommandFromPath();
    if (fromPath) return fromPath;

    if (platform === 'win32' && (await hasNvidiaGpu())) {
        const basePath = `${WINDIR}\\System32\\DriverStore\\FileRepository`;
        // find all directories that have an nvidia-smi.exe file
        const candidateDirs = await asyncFilter(await fs.readdir(basePath), async (dir) =>
            (await fs.readdir(path.join(basePath, dir))).includes('nvidia-smi.exe')
        );
        // use the directory with the most recently created nvidia-smi.exe file
        const targetDir = (
            await Promise.all(
                candidateDirs.map(async (dir) => {
                    const nvidiaSmi = await fs.stat(path.join(basePath, dir, 'nvidia-smi.exe'));
                    return { dir, time: nvidiaSmi.ctimeMs };
                })
            )
        ).reduce((prev, current) => {
            return prev.time > current.time ? prev : current;
        }).dir;

        if (targetDir) {
            return path.join(basePath, targetDir, 'nvidia-smi.exe');
        }
        // check if smi is in System32
        const smiPath = `${WINDIR}\\System32\\nvidia-smi.exe`;
        if ((await fs.stat(smiPath)).isFile()) {
            return smiPath;
        }
    }
    return undefined;
};

export const getNvidiaSmi = lazy(async (): Promise<string | undefined> => {
    try {
        return await getNvidiaSmiCommand();
    } catch (error) {
        log.warn(`Error occurred while checking for nvidia-smi: ${String(error)}`);
        return undefined;
    }
});

export const getNvidiaGpuNames = async (nvidiaSmi: string): Promise<string[]> => {
    const nvidiaGpus = (
        await exec(
            `"${nvidiaSmi}" --query-gpu=name --format=csv,noheader,nounits ${
                process.platform === 'linux' ? '  2>/dev/null' : ''
            }`
        )
    ).stdout.split('\n');
    return nvidiaGpus.slice(0, nvidiaGpus.length - 1);
};

export const createNvidiaSmiVRamChecker = (
    nvidiaSmi: string,
    delay: number,
    onReport: (usage: number) => void
) => {
    const vramChecker = spawn(
        nvidiaSmi,
        `-lms ${delay} --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory --format=csv,noheader,nounits`.split(
            ' '
        )
    );

    vramChecker.stdout.on('data', (data) => {
        const [, vramTotal, vramUsed] = String(data).split(/\s*,\s*/, 4);
        const usage = (Number(vramUsed) / Number(vramTotal)) * 100;
        if (Number.isFinite(usage)) {
            onReport(usage);
        }
    });

    return vramChecker;
};
