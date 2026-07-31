import { createReadStream } from 'fs';
import fs from 'fs/promises';
import Downloader from 'nodejs-file-downloader';
import path from 'path';
import semver from 'semver';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import { PythonInfo } from '../../common/common-types';
import { log } from '../../common/log';
import { isArmMac } from '../env';
import { SupportedPlatform, getPlatform } from '../platform';
import { checkFileExists } from '../util';
import { checkPythonPaths } from './checkPythonPaths';

interface PythonDownload {
    url: string;
    version: string;
    path: string;
}

const downloads: Record<SupportedPlatform, PythonDownload> = {
    linux: {
        url: 'https://github.com/indygreg/python-build-standalone/releases/download/20230826/cpython-3.11.5+20230826-x86_64-unknown-linux-gnu-install_only.tar.gz',
        version: '3.11.5',
        path: 'python/bin/python3.11',
    },
    darwin: {
        url: isArmMac
            ? 'https://github.com/indygreg/python-build-standalone/releases/download/20230826/cpython-3.11.5+20230826-aarch64-apple-darwin-install_only.tar.gz'
            : 'https://github.com/indygreg/python-build-standalone/releases/download/20230826/cpython-3.11.5+20230826-x86_64-apple-darwin-install_only.tar.gz',
        version: '3.11.5',
        path: 'python/bin/python3.11',
    },
    win32: {
        url: 'https://github.com/indygreg/python-build-standalone/releases/download/20230826/cpython-3.11.5+20230826-x86_64-pc-windows-msvc-shared-install_only.tar.gz',
        version: '3.11.5',
        path: 'python/python.exe',
    },
};

const extractPython = async (
    directory: string,
    tarPath: string,
    onProgress: (percent: number) => void
) => {
    await fs.mkdir(directory, { recursive: true });

    // Progress is tracked by how much of the (compressed) archive has been consumed, since the
    // number of entries in the archive isn't known until it has been fully read.
    const { size: totalBytes } = await fs.stat(tarPath);
    let readBytes = 0;
    const trackProgress = new Transform({
        transform: (chunk: Buffer, _encoding, callback) => {
            readBytes += chunk.length;
            onProgress(totalBytes > 0 ? Math.min(100, (readBytes / totalBytes) * 100) : 0);
            callback(null, chunk);
        },
    });

    // `tar` refuses to extract entries with absolute paths or `..` segments, so the archive cannot
    // write outside of `directory`.
    await pipeline(createReadStream(tarPath), trackProgress, tar.extract({ cwd: directory }));

    onProgress(100);
};

export const getIntegratedPythonExecutable = (directory: string): string => {
    const platform = getPlatform();
    const { path: relativePath } = downloads[platform];
    return path.resolve(path.join(directory, relativePath));
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
    const { url, version } = downloads[platform];

    const pythonPath = getIntegratedPythonExecutable(directory);
    const pythonBinExists = await checkFileExists(pythonPath);

    if (pythonBinExists) {
        const pythonInfo = await checkPythonPaths([pythonPath]);
        if (semver.eq(pythonInfo.version, version)) {
            return pythonInfo;
        }
    }

    // Invalid version, remove legacy integrated python
    const legacyPythonFolder = path.resolve(path.join(directory, '/python'));
    await fs.rm(legacyPythonFolder, { recursive: true, force: true });

    log.info(`Integrated Python not found at ${pythonPath}`);

    const tarName = 'python.tar.gz';
    const tarPath = path.join(directory, tarName);

    log.info('Downloading integrated Python...');
    onProgress(0, 'download');
    await new Downloader({
        url,
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

    return checkPythonPaths([pythonPath]);
};
