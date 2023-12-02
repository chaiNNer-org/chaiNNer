import { exec as _exec } from 'child_process';
import decompress from 'decompress';
import fs from 'fs/promises';
import Downloader from 'nodejs-file-downloader';
import path from 'path';
import util from 'util';
import { FfmpegInfo } from '../../common/common-types';
import { isArmMac } from '../../common/env';
import { log } from '../../common/log';
import { assertNever, checkFileExists } from '../../common/util';
import { SupportedPlatform, getPlatform } from '../platform';

const exec = util.promisify(_exec);

const downloads: Record<SupportedPlatform, string> = {
    linux: 'https://github.com/chaiNNer-org/ffmpeg-rehost/releases/download/ffmpeg/ffmpeg-linux-x64.zip',
    darwin: isArmMac
        ? 'https://github.com/chaiNNer-org/ffmpeg-rehost/releases/download/ffmpeg/ffmpeg-darwin-arm64.zip'
        : 'https://github.com/chaiNNer-org/ffmpeg-rehost/releases/download/ffmpeg/ffmpeg-darwin-x64.zip',
    win32: 'https://github.com/chaiNNer-org/ffmpeg-rehost/releases/download/ffmpeg/ffmpeg-win32-x64.zip',
};

const getExecutableRelativePath = (platform: SupportedPlatform): FfmpegInfo => {
    switch (platform) {
        case 'win32':
            return { ffmpeg: '/ffmpeg.exe', ffprobe: '/ffprobe.exe' };
        case 'linux':
        case 'darwin':
            return { ffmpeg: '/ffmpeg', ffprobe: '/ffprobe' };
        default:
            return assertNever(platform);
    }
};

const extractFfmpeg = async (
    directory: string,
    tarPath: string,
    onProgress: (percent: number) => void,
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
        }),
    );
};

/**
 * Retrieves the path of the ffmpeg executable of the integrated ffmpeg installation.
 *
 * If the installation does not exist, ffmpeg will be downloaded and installed.
 */
export const getIntegratedFfmpeg = async (
    directory: string,
    onProgress: (percentage: number, stage: 'download' | 'extract') => void,
): Promise<FfmpegInfo> => {
    const platform = getPlatform();
    const { ffmpeg, ffprobe } = getExecutableRelativePath(platform);
    if (!ffmpeg || !ffprobe) {
        throw new Error(`Unsupported platform: ${platform}`);
    }
    const ffmpegPath = path.resolve(path.join(directory, ffmpeg));
    const ffprobePath = path.resolve(path.join(directory, ffprobe));

    const ffmpegBinExists = await checkFileExists(ffmpegPath);

    if (!ffmpegBinExists) {
        log.info(`Integrated FFMPEG not found at ${ffmpegPath}`);

        const zipName = 'ffmpeg.zip';
        const zipPath = path.join(directory, zipName);

        log.info('Downloading integrated FFMPEG...');
        onProgress(0, 'download');
        await new Downloader({
            url: downloads[platform],
            directory,
            fileName: zipName,
            cloneFiles: false,
            onProgress: (percentage) => onProgress(Number(percentage), 'download'),
        }).download();

        log.info('Extracting integrated FFMPEG...');
        onProgress(0, 'extract');
        await extractFfmpeg(directory, zipPath, (percentage) => onProgress(percentage, 'extract'));

        log.info('Removing downloaded files...');
        await fs.rm(zipPath);

        // Un-Quarantine ffmpeg on macOS
        if (platform === 'darwin') {
            try {
                // xattr -dr com.apple.quarantine <pathtotheffmpegfile>
                await exec(`xattr -dr com.apple.quarantine "${ffmpegPath}"`);
                await exec(`xattr -dr com.apple.quarantine "${ffprobePath}"`);
            } catch (error) {
                log.warn(error);
            }
            // M1 can only run signed files, we must ad-hoc sign it
            if (isArmMac) {
                try {
                    // xattr -cr <pathtotheffmpegfile>
                    // codesign -s - <pathtotheffmpegfile>
                    await exec(`xattr -cr "${ffmpegPath}"`);
                    await exec(`xattr -cr "${ffprobePath}"`);
                    await exec(`codesign -s - "${ffmpegPath}"`);
                    await exec(`codesign -s - "${ffprobePath}"`);
                } catch (error) {
                    log.warn(error);
                }
            }
        }

        if (platform === 'linux' || platform === 'darwin') {
            log.info('Granting permissions for integrated ffmpeg...');
            try {
                await fs.chmod(ffmpegPath, 0o7777);
                await fs.chmod(ffprobePath, 0o7777);
            } catch (error) {
                log.warn(error);
            }
        }
    }

    return { ffmpeg: ffmpegPath, ffprobe: ffprobePath };
};

export const hasSystemFfmpeg = async () => {
    try {
        await exec('ffmpeg -version');
        return true;
    } catch (error) {
        return false;
    }
};
