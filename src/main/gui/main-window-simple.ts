import { BrowserWindow, app } from 'electron/main';
import { log } from '../../common/log';
import { ChainnerSettings } from '../../common/settings/settings';
import { OpenArguments } from '../arguments';
import { setupNodeBackend } from '../backend/setup-node';
import { getRootDir } from '../platform';
import { BrowserWindowWithSafeIpc, ipcMain } from '../safeIpc';
import { writeSettings } from '../setting-storage';

export const createSimpleMainWindow = async (
    args: OpenArguments,
    settings: ChainnerSettings
): Promise<void> => {
    log.info('Creating simplified main window with Node.js backend');

    // Start Node.js backend
    const { backend, url } = await setupNodeBackend();

    // Create the browser window
    const mainWindow: BrowserWindowWithSafeIpc = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#1a202c',
        minWidth: 720,
        minHeight: 480,
        darkTheme: true,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY as unknown as string,
        },
    });

    // Load the index.html
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL as unknown as string);

    // Set up IPC handlers
    setupIpcHandlers(mainWindow, settings, url);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (args.devtools) {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    // Handle window close
    mainWindow.on('closed', () => {
        backend.stop().catch(log.error);
    });

    // Clean up backend on app quit
    app.on('before-quit', () => {
        backend.stop().catch(log.error);
    });
};

function setupIpcHandlers(
    mainWindow: BrowserWindowWithSafeIpc,
    initialSettings: ChainnerSettings,
    backendUrl: string
) {
    // Settings handlers
    let currentSettings = initialSettings;
    let savingInProgress = false;

    ipcMain.handle('get-settings', () => currentSettings);
    ipcMain.handle('set-settings', (_, newSettings: ChainnerSettings) => {
        currentSettings = newSettings;
        if (savingInProgress) {
            return;
        }
        savingInProgress = true;
        setTimeout(() => {
            savingInProgress = false;
            try {
                writeSettings(currentSettings);
            } catch (error) {
                log.error('Unable to save settings.', error);
            }
        }, 1000);
    });

    // Backend URL handler
    ipcMain.handle('get-backend-url', () => backendUrl);

    // System info handlers
    ipcMain.on('get-app-version-sync', (event) => {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = app.getVersion();
    });

    ipcMain.on('get-appdata-sync', (event) => {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = getRootDir();
    });

    // Quit handler
    ipcMain.handle('quit-application', () => {
        app.exit();
    });

    // Stub handlers for compatibility (will be implemented later)
    ipcMain.on('enable-menu', () => {
        log.info('Menu enabled (stub)');
    });

    ipcMain.on('disable-menu', () => {
        log.info('Menu disabled (stub)');
    });
}
