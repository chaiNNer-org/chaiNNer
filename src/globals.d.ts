// eslint-disable-next-line no-var
declare var startupFile: string | null;

interface Window {
    unsafeIpcRenderer: import('electron').IpcRenderer;
    appConstants: {
        appVersion: import('./common/common-types').Version;
        isMac: boolean;
        isArmMac: boolean;
        appDataPath: string;
    };
}
