import decompress from 'decompress';
import fs from 'fs/promises';
import Downloader from 'nodejs-file-downloader';
import path from 'path';
import { gt, lt } from 'semver';
import { PythonInfo } from '../../common/common-types';
import { isArmMac } from '../../common/env';
import { log } from '../../common/log';
import { assertNever, checkFileExists } from '../../common/util';
import { SupportedPlatform, getPlatform } from '../platform';
import { checkPythonPaths } from './checkPythonPaths';
import { getPythonVersion } from './version';

const downloads: Record<SupportedPlatform, string> = {
    linux: 'https://github.com/indygreg/python-build-standalone/releases/download/20230726/cpython-3.11.4+20230726-x86_64-unknown-linux-gnu-install_only.tar.gz',
    darwin: isArmMac
        ? 'https://github.com/indygreg/python-build-standalone/releases/download/20230726/cpython-3.11.4+20230726-aarch64-apple-darwin-install_only.tar.gz'
        : 'https://github.com/indygreg/python-build-standalone/releases/download/20230726/cpython-3.11.4+20230726-x86_64-apple-darwin-install_only.tar.gz',
    win32: 'https://github.com/indygreg/python-build-standalone/releases/download/20230726/cpython-3.11.4+20230726-x86_64-pc-windows-msvc-shared-install_only.tar.gz',
};

const get39ExecutableRelativePath = (platform: SupportedPlatform): string => {
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

const getExecutableRelativePath = (platform: SupportedPlatform): string => {
    switch (platform) {
        case 'win32':
            return '/python/python.exe';
        case 'linux':
            return '/python/bin/python3.11';
        case 'darwin':
            return '/python/bin/python3.11';
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
    const legacyPythonPath = path.resolve(
        path.join(directory, get39ExecutableRelativePath(platform))
    );

    const legacyPythonBinExists = await checkFileExists(legacyPythonPath);

    if (legacyPythonBinExists) {
        const confirmLegacyPythonVersion = await getPythonVersion(legacyPythonPath);
        if (gt(confirmLegacyPythonVersion, '3.9.0') && lt(confirmLegacyPythonVersion, '3.10.0')) {
            const legacyPythonFolder = path.resolve(path.join(directory, '/python'));
            // Remove legacy integrated python
            await fs.rm(legacyPythonFolder, { recursive: true, force: true });
        }
    }

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

    return checkPythonPaths([pythonPath]);
};
