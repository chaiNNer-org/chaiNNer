import { spawn } from 'child_process';
import decompress, { File } from 'decompress';
import log from 'electron-log';
import fs from 'fs/promises';
import Downloader from 'nodejs-file-downloader';
import os from 'os';
import path from 'path';
import pipInstallWithProgress from '../common/pipInstallWithProgress';
import downloads from './downloads';

export const downloadPython = async (directory: string, onProgress: (progress: string) => void) => {
    const platform = os.platform();
    const url = (downloads.python as Partial<Record<NodeJS.Platform, string>>)[platform];
    if (!url) {
        log.warn(`Unsupported platform ${platform}`);
        return;
    }

    const downloader = new Downloader({
        url,
        directory,
        fileName: 'python.tar.gz',
        // (percentage, chunk, remainingSize)
        onProgress,
    });
    try {
        await downloader.download();
    } catch (error) {
        log.error(error);
    }
};

export const extractPython = async (
    directory: string,
    pythonPath: string,
    onProgress: (percent: number) => void
) => {
    const fileData: File[] = Array.from(await decompress(path.join(directory, '/python.tar.gz')));
    const totalFiles = fileData.length;
    let doneCounter = 0;
    await Promise.all(
        fileData.map(async (file: File) => {
            const filePath = path.join(directory, file.path);
            const fileDir = path.dirname(filePath);
            await fs.mkdir(fileDir, { recursive: true });
            await fs.writeFile(filePath, file.data);
            const percentageComplete = (doneCounter / totalFiles) * 100;
            doneCounter += 1;
            onProgress(percentageComplete);
        })
    );
    await fs.rm(path.join(directory, '/python.tar.gz'));
    if (['linux', 'darwin'].includes(os.platform())) {
        try {
            log.info('Granting perms for integrated python...');
            await fs.chmod(pythonPath, 0o7777).catch((error) => {
                log.error(error);
            });
        } catch (error) {
            log.error(error);
        }
    }
};

const upgradePip = async (pythonPath: string) =>
    new Promise<void>((resolve, reject) => {
        const pipUpgrade = spawn(
            pythonPath,
            '-m pip install --upgrade pip --no-warn-script-location'.split(' ')
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        pipUpgrade.stdout.on('data', (data) => {
            // onProgress(getPipPercentFromData(data));
        });
        pipUpgrade.stderr.on('data', (data) => {
            log.error(`Error updating pip: ${String(data)}`);
            reject(new Error(`Error updating pip: ${String(data)}`));
        });
        pipUpgrade.on('close', () => {
            resolve();
        });
    });

const pipInstallSanic = async (pythonPath: string, onProgress: (percent: number) => void) => {
    const sanicDep = {
        name: 'Sanic',
        packageName: 'sanic',
        version: '21.9.3',
    };
    await pipInstallWithProgress(pythonPath, sanicDep, onProgress);
};

const pipInstallSanicCors = async (pythonPath: string, onProgress: (percent: number) => void) => {
    const sanicCorsDep = {
        name: 'Sanic-Cors',
        packageName: 'Sanic-Cors',
        version: '1.0.1',
    };
    await pipInstallWithProgress(pythonPath, sanicCorsDep, onProgress);
};

export const installSanic = async (pythonPath: string, onProgress: (percent: number) => void) => {
    log.info('Updating internal pip');
    await upgradePip(pythonPath);
    log.info('Installing Sanic to internal python');
    await pipInstallSanic(pythonPath, onProgress);
    log.info('Installing Sanic-Cors to internal python');
    await pipInstallSanicCors(pythonPath, onProgress);
};
