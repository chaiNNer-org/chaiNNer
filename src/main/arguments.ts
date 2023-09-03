import yargs from 'yargs/yargs';
import { assertNever } from '../common/util';

interface ArgumentOptions {
    remoteBackend: string | undefined;
    refresh: boolean;
}
export interface OpenArguments extends ArgumentOptions {
    command: 'open';
    file: string | undefined;
    devtools: boolean;
}
export interface RunArguments extends ArgumentOptions {
    command: 'run';
    file: string;
    overrideFile: string | undefined;
}
export type ParsedArguments = OpenArguments | RunArguments;

/**
 * Parses the given arguments.
 *
 * If the arguments are invalid, an error message will be logged in the terminal and the process will be terminated.
 */
export const parseArgs = (args: readonly string[]): ParsedArguments => {
    const parsed = yargs(args)
        .scriptName('chainner')
        .command(['* [file]', 'open [file]'], 'Open the chaiNNer GUI', (y) => {
            return y
                .positional('file', {
                    type: 'string',
                    description: 'An optional chain to open. This should be a .chn file',
                })
                .options({
                    devtools: {
                        type: 'boolean',
                        default: false,
                        description: "Open Electron's DevTools on launch.",
                    },
                });
        })
        .command(
            'run <file>',
            'Run the given chain in the command line without opening the GUI',
            (y) => {
                return y
                    .positional('file', {
                        type: 'string',
                        description: 'The chain to run. This should be a .chn file',
                    })
                    .options({
                        override: {
                            type: 'string',
                            description:
                                'An optional JSON file with input overrides.' +
                                ' The file is expected to have the following structure: `{ "inputs": { "<input id>": string | number | null } }`.' +
                                ' Input ids can be obtained in the GUI by right-clicking on an overridable input.' +
                                ' Note that not all inputs are overridable.' +
                                ' Right now, only number, text, file, and directory inputs are supported.',
                        },
                    });
            }
        )
        .options({
            remoteBackend: {
                type: 'string',
                description:
                    'The URL of a remote backend to use. If provided, chaiNNer will not spawn a backend process and will connect to the backend behind the URL instead. Example: http://127.0.0.1:8000' +
                    '\n\nDo not use this as this is not a stable option and may change or disappear at any time',
            },
            refresh: {
                type: 'boolean',
                default: false,
                description:
                    'An internal developer option to use a different backend. Do not use this as this is not a stable option and may change or disappear at any time',
                hidden: true,
            },
            // These are never used by chaiNNer, they just let the arguments through the arg parser so chromium can parse them.
            // Since they aren't used, the defaults don't matter
            'ozone-platform-hint': {
                type: 'string',
                default: '',
                description:
                    "On Linux, set to 'auto' to use Wayland if it's available, and X otherwise",
                hidden: true,
            },
            'enable-features': {
                type: 'string',
                default: '',
                description: 'Enable chromium features',
                hidden: true,
            },
        })
        .parserConfiguration({ 'unknown-options-as-args': true })
        .parseSync();

    const options: ArgumentOptions = {
        remoteBackend: parsed.remoteBackend || undefined,
        refresh: parsed.refresh,
    };

    const command = (parsed._[0] as ParsedArguments['command'] | undefined) ?? 'open';

    switch (command) {
        case 'open':
            return {
                command: 'open',
                file: parsed.file,
                devtools: parsed.devtools,
                ...options,
            };
        case 'run':
            return {
                command: 'run',
                file: parsed.file!,
                overrideFile: parsed.override,
                ...options,
            };
        default:
            return assertNever(command);
    }
};
