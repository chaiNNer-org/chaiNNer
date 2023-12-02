import electronLog from 'electron-log';
import path from 'path';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { LEVEL_NAME, log } from '../common/log';
import { ipcRenderer } from '../common/safeIpc';
import { App } from './app';

ipcRenderer
    .invoke('get-appdata')
    .then((rootDir) => {
        electronLog.transports.file.resolvePath = (variables) =>
            path.join(rootDir, 'logs', variables.fileName!);
        electronLog.transports.file.level = 'info';
        electronLog.transports.console.level = 'debug';

        log.addTransport({
            log: ({ level, message, additional }) => {
                electronLog[LEVEL_NAME[level]](message, ...additional);
            },
        });
    })
    .catch((err) => {
        electronLog.error(err);
    });

const queryClient = new QueryClient();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <QueryClientProvider client={queryClient}>
        <App />
    </QueryClientProvider>,
);
