import decompress from 'decompress';
import log from 'electron-log';
import fs from 'fs/promises';
import Downloader from 'nodejs-file-downloader';
import os from 'os';
import path from 'path';
import { PythonInfo } from '../../common/common-types';
import { isM1 } from '../../common/env';
import { assertNever, checkFileExists } from '../../common/util';
import { getPythonVersion, isSupportedPythonVersion } from './version';

const downloads: Record<SupportedPlatform, string> = {
    linux: 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-unknown-linux-gnu-install_only-20211017T1616.tar.gz',
    darwin: isM1
        ? 'https://github.com/indygreg/python-build-standalone/releases/download/20220318/cpython-3.9.11+20220318-aarch64-apple-darwin-install_only.tar.gz'
        : 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-apple-darwin-install_only-20211017T1616.tar.gz',
    win32: 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-pc-windows-msvc-shared-install_only-20211017T1616.tar.gz',
};

type SupportedPlatform = 'linux' | 'darwin' | 'win32';

const getPlatform = (): SupportedPlatform => {
    const platform = os.platform();
    switch (platform) {
        case 'win32':
        case 'linux':
        case 'darwin':
            return platform;
        default:
            throw new Error(
                `Unsupported platform: Integrated Python is not supported on ${platform}.`
            );
    }
};

const getExecutableRelativePath = (platform: SupportedPlatform): string => {
    switch (platform) {
        case 'win32':
            return '/python/python.exe';
        case 'linux':
            return '/python/bin/python3.9';
        case 'darwin':
            return '/python/bin/python3.9';
        default:
            return assertNever(platform);
    }
};

const extractPython = async (
    directory: string,
    tarPath: string,
    onProgress: (percent: number) => void
) => {
    const files = await decompress(tarPath);
    const totalFiles = files.length;
    let doneCounter = 0;

    await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(directory, file.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, file.data);
            const percentageComplete = (doneCounter / totalFiles) * 100;
            doneCounter += 1;
            onProgress(percentageComplete);
        })
    );
};

/**
 * Retrieves the path of the python executable of the integrated python installation.
 *
 * If the installation does not exist, python will be downloaded and installed.
 */
export const getIntegratedPython = async (
    directory: string,
    onProgress: (percentage: number, stage: 'download' | 'extract') => void
): Promise<PythonInfo> => {
    const platform = getPlatform();
    const pythonPath = path.resolve(path.join(directory, getExecutableRelativePath(platform)));

    const pythonBinExists = await checkFileExists(pythonPath);

    if (!pythonBinExists) {
        log.info(`Integrated Python not found at ${pythonPath}`);

        const tarName = 'python.tar.gz';
        const tarPath = path.join(directory, tarName);

        log.info('Downloading integrated Python...');
        onProgress(0, 'download');
        await new Downloader({
            url: downloads[platform],
            directory,
            fileName: tarName,
            cloneFiles: false,
            onProgress: (percentage) => onProgress(Number(percentage), 'download'),
        }).download();

        log.info('Extracting integrated Python...');
        onProgress(0, 'extract');
        await extractPython(directory, tarPath, (percentage) => onProgress(percentage, 'extract'));

        log.info('Removing downloaded files...');
        await fs.rm(tarPath);

        if (platform === 'linux' || platform === 'darwin') {
            log.info('Granting permissions for integrated python...');
            try {
                await fs.chmod(pythonPath, 0o7777);
            } catch (error) {
                log.warn(error);
            }
        }
    }

    const version = await getPythonVersion(pythonPath).catch(() => null);
    if (version && isSupportedPythonVersion(version)) {
        return { python: pythonPath, version };
    }

    throw new Error(`Integrated python version ${String(version)} not supported`);
};
