import decompress, { File } from 'decompress';
import log from 'electron-log';
import fs from 'fs/promises';
import Downloader from 'nodejs-file-downloader';
import os from 'os';
import path from 'path';
import { requiredDependencies } from '../common/dependencies';
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

export const installRequiredDeps = async (
    pythonPath: string,
    onProgress: (percent: number) => void
): Promise<void> => {
    for (const dep of requiredDependencies) {
        // eslint-disable-next-line no-await-in-loop
        await pipInstallWithProgress(pythonPath, dep, onProgress, () => {}, true);
    }
    return Promise.resolve();
};
