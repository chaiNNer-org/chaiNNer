import { t } from 'i18next';
import path from 'path';
import portfinder from 'portfinder';
import { PythonInfo } from '../../common/common-types';
import { log } from '../../common/log';
import { CriticalError } from '../../common/ui/error';
import { ProgressToken } from '../../common/ui/progress';
import { getBackendStorageFolder, getLogsFolder } from '../platform';
import { checkPythonPaths } from '../python/checkPythonPaths';
import { getIntegratedPython, getIntegratedPythonExecutable } from '../python/integratedPython';
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

interface PythonSetupConfig {
    integratedPythonFolder: string;
    systemPythonLocation: string | undefined | null;
}
const getSystemPythonInfo = async (token: ProgressToken, config: PythonSetupConfig) => {
    log.info('Attempting to check system Python env...');

    const { integratedPythonFolder } = config;
    let { systemPythonLocation } = config;

    if (systemPythonLocation) {
        try {
            systemPythonLocation = path.normalize(systemPythonLocation);
        } catch (error) {
            log.error(`Ignoring system python location because of error: ${String(error)}`);

            systemPythonLocation = null;
        }
    }

    const integratedPython = getIntegratedPythonExecutable(integratedPythonFolder);

    try {
        const pythonInfo = await checkPythonPaths([
            ...(systemPythonLocation ? [systemPythonLocation] : []),
            'python3',
            'python',
            // Fall back to integrated python if all else fails
            integratedPython,
        ]);

        if (pythonInfo.python === integratedPython) {
            log.info('System python not found. Using integrated Python');
            await token.submitInterrupt({
                type: 'warning',
                title: 'System Python not installed or invalid version',
                message:
                    'It seems like you do not have a valid version of Python installed on your system, or something went wrong with your installed instance.' +
                    ' Please install Python (3.8+) if you would like to use system Python. You can get Python from https://www.python.org/downloads/.' +
                    ' Be sure to select the add to PATH option.' +
                    '\n\nChaiNNer will start using its integrated Python for now.' +
                    ' You can change this later in the settings.',
                options: [
                    {
                        title: 'Get Python',
                        action: { type: 'open-url', url: 'https://www.python.org/downloads/' },
                    },
                ],
            });
        }

        return pythonInfo;
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
};
const getIntegratedPythonInfo = async (
    token: ProgressToken,
    config: PythonSetupConfig
): Promise<PythonInfo> => {
    log.info('Attempting to check integrated Python env...');

    const { integratedPythonFolder } = config;

    // User is using integrated python
    try {
        return await getIntegratedPython(integratedPythonFolder, (percentage, stage) => {
            token.submitProgress({
                status:
                    stage === 'download'
                        ? t('setup.downloadingPython', 'Downloading Integrated Python...')
                        : t('setup.extractingPython', 'Extracting downloaded files...'),
                totalProgress: stage === 'download' ? 0.3 : 0.4,
                statusProgress: percentage / 100,
            });
        });
    } catch (error) {
        log.error(error);

        enum Action {
            Retry,
            System,
            Crash,
        }
        let action: Action = Action.Crash as Action;
        await token.submitInterrupt({
            type: 'warning',
            title: 'Unable to install integrated Python',
            message:
                'ChaiNNer needs and active internet connection and access to the network to install its integrated Python environment. Please ensure an active internet connection and try again.' +
                '\n\nAlternatively, chaiNNer can use your system Python environment instead if you have Python 3.8+ installed. (Note that chaiNNer will install packages into your system Python environment if you choose this option.)' +
                '\n\nChaiNNer requires a valid Python environment to run. Please choose one of the following options:',
            options: [
                {
                    title: 'Retry to install integrated Python',
                    action: {
                        type: 'run',
                        action: () => {
                            action = Action.Retry;
                        },
                    },
                },
                {
                    title: 'Use System Python instead',
                    action: {
                        type: 'run',
                        action: () => {
                            action = Action.System;
                        },
                    },
                },
                {
                    title: 'Exit',
                    action: {
                        type: 'run',
                        action: () => {
                            action = Action.Crash;
                        },
                    },
                },
            ],
        });

        if (action === Action.Retry) {
            return getIntegratedPythonInfo(token, config);
        }
        if (action === Action.System) {
            return getSystemPythonInfo(token, config);
        }

        throw new CriticalError({
            title: 'Unable to install integrated Python',
            message:
                `Chainner was unable to install its integrated Python environment.` +
                ` Please ensure that your computer is connected to the internet and that chainner has access to the network.`,
        });
    }
};
const getPythonInfo = async (
    token: ProgressToken,
    useSystemPython: boolean,
    systemPythonLocation: string | undefined | null,
    rootDir: string
) => {
    const config: PythonSetupConfig = {
        integratedPythonFolder: path.normalize(path.join(rootDir, 'python')),
        systemPythonLocation,
    };

    const pythonInfo = useSystemPython
        ? await getSystemPythonInfo(token, config)
        : await getIntegratedPythonInfo(token, config);

    log.info(`Final Python binary: ${pythonInfo.python}`);
    log.info(pythonInfo);

    return pythonInfo;
};

const spawnBackend = (port: number, pythonInfo: PythonInfo) => {
    try {
        const backend = OwnedBackendProcess.spawn({
            port,
            python: pythonInfo,
            storageDir: getBackendStorageFolder(),
            logsDir: getLogsFolder(),
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
    rootDir: string
): Promise<OwnedBackendProcess> => {
    token.submitProgress({
        status: t('setup.checkingPort', 'Checking for available port...'),
        totalProgress: 0.1,
    });
    const port = await getValidPort();

    token.submitProgress({
        status: t('setup.checkingPython', 'Checking system environment for valid Python...'),
        totalProgress: 0.3,
    });
    const pythonInfo = await getPythonInfo(token, useSystemPython, systemPythonLocation, rootDir);

    token.submitProgress({
        status: t('setup.startingBackend', 'Starting up backend process...'),
        totalProgress: 0.7,
    });
    return spawnBackend(port, pythonInfo);
};

const setupBorrowedBackend = async (
    token: ProgressToken,
    url: string
): Promise<BorrowedBackendProcess> => {
    log.info(`Attempting to setup backend from ${url}...`);

    token.submitProgress({
        status: t('setup.startingBackend', 'Starting up backend process...'),
        totalProgress: 0.8,
    });
    return BorrowedBackendProcess.fromUrl(url);
};

export const setupBackend = async (
    token: ProgressToken,
    useSystemPython: boolean,
    systemPythonLocation: string | undefined | null,
    rootDir: string,
    remoteBackend: string | undefined
): Promise<BackendProcess> => {
    token.submitProgress({ totalProgress: 0 });

    const backend = remoteBackend
        ? await setupBorrowedBackend(token, remoteBackend)
        : await setupOwnedBackend(token, useSystemPython, systemPythonLocation, rootDir);

    token.submitProgress({ totalProgress: 1 });
    return backend;
};
