import electronLog from 'electron-log/renderer';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { LEVEL_NAME, log } from '../common/log';
import { App } from './app';

electronLog.transports.ipc.level = 'info';
electronLog.transports.console.level = 'debug';
log.addTransport({
    log: ({ level, message, additional }) => {
        electronLog[LEVEL_NAME[level]](message, ...additional);
    },
});

const queryClient = new QueryClient();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <QueryClientProvider client={queryClient}>
        <App />
    </QueryClientProvider>
);
