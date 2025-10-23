import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { LEVEL_NAME, log } from '../common/log';
import { App } from './app';
import { isElectron } from './isElectron';

// Only import electron-log when running in Electron
if (isElectron()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require, @typescript-eslint/no-unsafe-assignment, no-restricted-globals
    const { default: electronLog } = require('electron-log/renderer');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    electronLog.transports.ipc.level = 'info';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    electronLog.transports.console.level = 'debug';
    log.addTransport({
        log: ({ level, message, additional }) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            electronLog[LEVEL_NAME[level]](message, ...additional);
        },
    });
} else {
    // In web mode, use console logging
    log.addTransport({
        log: ({ level, message, additional }) => {
            const logFn =
                // eslint-disable-next-line no-nested-ternary
                level === 0
                    ? // eslint-disable-next-line no-console
                      console.error
                    : level === 1
                    ? // eslint-disable-next-line no-console
                      console.warn
                    : // eslint-disable-next-line no-console
                      console.log;
            logFn(`[${LEVEL_NAME[level]}]`, message, ...additional);
        },
    });
}

const queryClient = new QueryClient();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <QueryClientProvider client={queryClient}>
        <App />
    </QueryClientProvider>
);
