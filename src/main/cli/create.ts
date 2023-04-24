import { app } from 'electron';
import electronLog from 'electron-log';
import { log } from '../../common/log';
import { Exit } from './exit';

const fatalErrorInMain = (error: unknown) => {
    log.error('Error in Main process');
    log.error(error);
    app.exit(1);
};

const setupErrorHandling = () => {
    electronLog.catchErrors({
        showDialog: false,
        onError: fatalErrorInMain,
    });

    process.on('uncaughtException', fatalErrorInMain);
};

export const createCli = (command: () => Promise<void>) => {
    setupErrorHandling();

    // we don't need hardware acceleration at all
    app.disableHardwareAcceleration();

    command().then(
        () => {
            app.exit(0);
        },
        (error) => {
            if (error instanceof Exit) {
                app.exit(error.exitCode);
            } else {
                log.error(error);
                app.exit(1);
            }
        }
    );
};
