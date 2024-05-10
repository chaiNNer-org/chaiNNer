// eslint-disable-next-line no-var
declare var startupFile: string | null;

interface Window {
    unsafeIpcRenderer: import('electron').IpcRenderer;
}
