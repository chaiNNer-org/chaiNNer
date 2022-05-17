import { app } from 'electron';
import log from 'electron-log';
import yargs from 'yargs/yargs';
import { lazy } from '../common/util';

export interface ParsedArguments {
    /**
     * A file the user wants to open.
     */
    file?: string;
    noBackend: boolean;
}

const parseArgs = (args: readonly string[]): ParsedArguments => {
    try {
        const parsed = yargs(args)
            .options({
                backend: { type: 'boolean', default: true },
            })
            .parseSync();

        const file = parsed._[0];

        return {
            file: file ? String(file) : undefined,
            noBackend: !parsed.backend,
        };
    } catch (error) {
        log.error('Failed to parse command line arguments');
        log.error(error);

        return {
            file: undefined,
            noBackend: false,
        };
    }
};

export const getArguments = lazy<ParsedArguments>(() => {
    const args = process.argv.slice(app.isPackaged ? 1 : 2);
    return parseArgs(args);
});
