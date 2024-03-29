import { BrowserWindow, MessageBoxOptions, app, dialog, shell } from 'electron';
import { log } from '../../common/log';
import { BrowserWindowWithSafeIpc } from '../../common/safeIpcCommon';
import { Progress, ProgressMonitor } from '../../common/ui/progress';
import { assertNever } from '../../common/util';

export type SplashStage = 'init' | 'done';

export const addSplashScreen = (monitor: ProgressMonitor) => {
    const splash = new BrowserWindow({
        width: 400,
        height: 400,
        frame: false,
        // backgroundColor: '#2D3748',
        center: true,
        minWidth: 400,
        minHeight: 400,
        maxWidth: 400,
        maxHeight: 400,
        resizable: false,
        minimizable: true,
        maximizable: false,
        closable: false,
        alwaysOnTop: false,
        titleBarStyle: 'hidden',
        transparent: true,
        roundedCorners: true,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: `${__dirname}/../public/icons/cross_platform/icon`,
        show: false,
    }) as BrowserWindowWithSafeIpc;

    let progressFinished = false;
    let lastProgress: Progress | undefined;

    if (!splash.isDestroyed()) {
        splash.loadURL(SPLASH_SCREEN_WEBPACK_ENTRY).catch((error) => {
            // the splashscreen can take super long to load, so we might have killed it while it is loading
            if (!progressFinished) {
                log.error('Error loading splash window.', error);
            }
        });
    }

    // This is a hack that solves 2 problems at one:
    // 1. Even after 'ready-to-show', React might still not be ready,
    //    so it's hard to say when we should re-send the last progress.
    // 2. The splash screen sometimes randomly reloads which resets the displayed progress.
    const intervalId = setInterval(() => {
        if (progressFinished || splash.isDestroyed()) {
            clearInterval(intervalId);
            return;
        }

        if (lastProgress) {
            splash.webContents.send('splash-setup-progress', lastProgress);
        }
    }, 100);

    splash.once('ready-to-show', () => {
        if (!splash.isDestroyed()) {
            splash.show();
        }
    });

    monitor.addProgressListener((progress) => {
        lastProgress = { ...progress };

        if (progress.totalProgress === 1) {
            progressFinished = true;
            splash.destroy();
        }
    });

    monitor.addInterruptListener(async (interrupt) => {
        const options = interrupt.options ?? [];

        let messageBoxOptions: MessageBoxOptions;
        if (interrupt.type === 'critical error') {
            if (!splash.isDestroyed()) {
                splash.hide();
            }

            messageBoxOptions = {
                type: 'error',
                title: interrupt.title ?? 'Critical error occurred',
                buttons: [...options.map((o) => o.title), 'Exit'],
                defaultId: options.length,
                message: interrupt.message,
            };
        } else {
            messageBoxOptions = {
                type: 'warning',
                title: interrupt.title ?? 'Critical error occurred',
                buttons: [...options.map((o) => o.title), 'Ok'],
                defaultId: options.length,
                message: interrupt.message,
            };
        }

        const { response } = await dialog.showMessageBox(messageBoxOptions);
        if (response < options.length) {
            const { action } = options[response];

            try {
                switch (action.type) {
                    case 'open-url': {
                        await shell.openExternal(action.url);
                        break;
                    }
                    default:
                        return assertNever(action.type);
                }
            } catch (error) {
                log.error(`Failed to execute action of type ${action.type}`, error);
            }
        }

        if (interrupt.type === 'critical error') {
            progressFinished = true;
            app.exit(1);
        }
    });
};
