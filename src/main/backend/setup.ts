import { t } from 'i18next';
import path from 'path';
import portfinder from 'portfinder';
import { FfmpegInfo, PythonInfo } from '../../common/common-types';
import { log } from '../../common/log';
import { CriticalError } from '../../common/ui/error';
import { ProgressToken } from '../../common/ui/progress';
import { getIntegratedFfmpeg, hasSystemFfmpeg } from '../ffmpeg/ffmpeg';
import { checkPythonPaths } from '../python/checkPythonPaths';
import { getIntegratedPython } from '../python/integratedPython';
import { BackendProcess, BorrowedBackendProcess, OwnedBackendProcess } from './process';

const getValidPort = async () => {
    log.info('Attempting to check for a port...');
    const port = await portfinder.getPortPromise();
    if (!port) {
        log.error('An open port could not be found');

        throw new CriticalError({
            title: 'No open port',
            message:
                'This error should never happen, but if it does it means you are running a lot of servers on your computer that just happen to be in the port range I look for. Quit some of those and then this will work.',
        });
    }
    log.info(`Port found: ${port}`);

    return port;
};

const getPythonInfo = async (
    token: ProgressToken,
    useSystemPython: boolean,
    systemPythonLocation: string | undefined | null,
    rootDir: string
) => {
    log.info('Attempting to check Python env...');

    let pythonInfo: PythonInfo;

    let integratedPythonFolderPath = path.join(rootDir, '/python');

    if (systemPythonLocation) {
        // eslint-disable-next-line no-param-reassign
        systemPythonLocation = path.normalize(String(JSON.parse(systemPythonLocation)));
    }

    if (integratedPythonFolderPath) {
        integratedPythonFolderPath = path.normalize(integratedPythonFolderPath);
    }

    if (useSystemPython) {
        try {
            pythonInfo = await checkPythonPaths([
                ...(systemPythonLocation ? [systemPythonLocation] : []),
                'python3',
                'python',
                // Fall back to integrated python if all else fails
                integratedPythonFolderPath,
            ]);
            if (pythonInfo.python === integratedPythonFolderPath) {
                log.info('System python not found. Using integrated Python');
                await token.submitInterrupt({
                    type: 'warning',
                    title: 'Python not installed or invalid version',
                    message:
                        'It seems like you do not have a valid version of Python installed on your system, or something went wrong with your installed instance.' +
                        ' Please install Python (3.8+) if you would like to use system Python. You can get Python from https://www.python.org/downloads/.' +
                        ' Be sure to select the add to PATH option. ChaiNNer will use its integrated Python for now.',
                    options: [
                        {
                            title: 'Get Python',
                            action: { type: 'open-url', url: 'https://www.python.org/downloads/' },
                        },
                    ],
                });
            }
        } catch (error) {
            log.error(error);
            throw new CriticalError({
                title: 'Error checking for valid Python instance',
                message:
                    'It seems like you do not have a valid version of Python installed on your system, or something went wrong with your installed instance.' +
                    ' Please install Python (3.8+) to use this application. You can get Python from https://www.python.org/downloads/. Be sure to select the add to PATH option.',
                options: [
                    {
                        title: 'Get Python',
                        action: { type: 'open-url', url: 'https://www.python.org/downloads/' },
                    },
                ],
            });
        }
    } else {
        // User is using integrated python
        try {
            pythonInfo = await getIntegratedPython(
                integratedPythonFolderPath,
                (percentage, stage) => {
                    token.submitProgress({
                        status:
                            stage === 'download'
                                ? t('splash.downloadingPython', 'Downloading Integrated Python...')
                                : t('splash.extractingPython', 'Extracting downloaded files...'),
                        totalProgress: stage === 'download' ? 0.3 : 0.4,
                        statusProgress: percentage / 100,
                    });
                }
            );
        } catch (error) {
            log.error(error);

            throw new CriticalError({
                title: 'Unable to install integrated Python',
                message:
                    `Chainner was unable to install its integrated Python environment.` +
                    ` Please ensure that your computer is connected to the internet and that chainner has access to the network.`,
            });
        }
    }

    log.info(`Final Python binary: ${pythonInfo.python}`);
    log.info(pythonInfo);

    return pythonInfo;
};

const getFfmpegInfo = async (token: ProgressToken, rootDir: string) => {
    log.info('Attempting to check Ffmpeg env...');

    let ffmpegInfo: FfmpegInfo;

    const integratedFfmpegFolderPath = path.join(rootDir, '/ffmpeg');

    try {
        ffmpegInfo = await getIntegratedFfmpeg(integratedFfmpegFolderPath, (percentage, stage) => {
            token.submitProgress({
                status:
                    stage === 'download'
                        ? t('splash.downloadingFfmpeg', 'Downloading ffmpeg...')
                        : t('splash.extractingFfmpeg', 'Extracting downloaded files...'),
                totalProgress: stage === 'download' ? 0.5 : 0.6,
                statusProgress: percentage / 100,
            });
        });
    } catch (error) {
        log.error(error);

        await token.submitInterrupt({
            type: 'warning',
            title: 'Unable to install integrated Ffmpeg',
            message: `Chainner was unable to install FFMPEG. Please ensure that your computer is connected to the internet and that chainner has access to the network or some functionality may not work properly.`,
        });

        if (await hasSystemFfmpeg()) {
            ffmpegInfo = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' };
        } else {
            ffmpegInfo = { ffmpeg: undefined, ffprobe: undefined };
        }
    }

    log.info(`Final ffmpeg binary: ${ffmpegInfo.ffmpeg ?? 'Not found'}`);
    log.info(`Final ffprobe binary: ${ffmpegInfo.ffprobe ?? 'Not found'}`);

    return ffmpegInfo;
};

const spawnBackend = (port: number, pythonInfo: PythonInfo, ffmpegInfo: FfmpegInfo) => {
    try {
        const backend = OwnedBackendProcess.spawn(port, pythonInfo, {
            STATIC_FFMPEG_PATH: ffmpegInfo.ffmpeg,
            STATIC_FFPROBE_PATH: ffmpegInfo.ffprobe,
        });

        return backend;
    } catch (error) {
        log.error('Error spawning backend.', error);
        throw new CriticalError({ message: 'Unable to start backend.' });
    }
};

const setupOwnedBackend = async (
    token: ProgressToken,
    useSystemPython: boolean,
    systemPythonLocation: string | undefined | null,
    hasNvidia: () => Promise<boolean>,
    rootDir: string
): Promise<OwnedBackendProcess> => {
    token.submitProgress({
        status: t('splash.checkingPort', 'Checking for available port...'),
        totalProgress: 0.1,
    });
    const port = await getValidPort();

    token.submitProgress({
        status: t('splash.checkingPython', 'Checking system environment for valid Python...'),
        totalProgress: 0.2,
    });
    const pythonInfo = await getPythonInfo(token, useSystemPython, systemPythonLocation, rootDir);

    token.submitProgress({
        status: t('splash.checkingFfmpeg', 'Checking system environment for Ffmpeg...'),
        totalProgress: 0.5,
    });
    const ffmpegInfo = await getFfmpegInfo(token, rootDir);

    token.submitProgress({
        status: t('splash.startingBackend', 'Starting up backend process...'),
        totalProgress: 0.8,
    });
    return spawnBackend(port, pythonInfo, ffmpegInfo);
};

const setupBorrowedBackend = async (
    token: ProgressToken,
    port: number
): Promise<BorrowedBackendProcess> => {
    log.info(`Attempting to setup backend from port ${port}...`);

    token.submitProgress({
        status: t('splash.startingBackend', 'Starting up backend process...'),
        totalProgress: 0.8,
    });
    return BorrowedBackendProcess.fromPort(port);
};

export const setupBackend = async (
    token: ProgressToken,
    useSystemPython: boolean,
    systemPythonLocation: string | undefined | null,
    hasNvidia: () => Promise<boolean>,
    rootDir: string,
    noOwnedBackend: boolean
): Promise<BackendProcess> => {
    token.submitProgress({ totalProgress: 0 });

    const backend = noOwnedBackend
        ? await setupBorrowedBackend(token, 8000)
        : await setupOwnedBackend(token, useSystemPython, systemPythonLocation, hasNvidia, rootDir);

    token.submitProgress({ totalProgress: 1 });
    return backend;
};
