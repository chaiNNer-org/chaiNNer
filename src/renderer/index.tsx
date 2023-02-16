import log from 'electron-log';
import path from 'path';
import { createRoot } from 'react-dom/client';
import { ipcRenderer } from '../common/safeIpc';
import { App } from './app';

ipcRenderer
    .invoke('get-appdata')
    .then((rootDir) => {
        log.transports.file.resolvePath = (variables) =>
            path.join(rootDir, 'logs', variables.fileName!);
        log.transports.file.level = 'info';
    })
    .catch((err) => {
        log.error(err);
    });

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
