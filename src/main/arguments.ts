import yargs from 'yargs/yargs';
import { assertNever } from '../common/util';

interface ArgumentOptions {
    noBackend: boolean;
    refresh: boolean;
}
export interface OpenArguments extends ArgumentOptions {
    command: 'open';
    file: string | undefined;
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
            return y.positional('file', {
                type: 'string',
                description: 'An optional chain to open. This should be a .chn file',
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
            backend: {
                type: 'boolean',
                default: true,
                description:
                    'An internal developer option to use a different backend. Do not use this as this is not a stable option and may change or disappear at any time',
                hidden: true,
            },
            refresh: {
                type: 'boolean',
                default: false,
                description:
                    'An internal developer option to use a different backend. Do not use this as this is not a stable option and may change or disappear at any time',
                hidden: true,
            },
        })
        .parserConfiguration({ 'unknown-options-as-args': true })
        .parseSync();

    const options: ArgumentOptions = {
        noBackend: !parsed.backend,
        refresh: parsed.refresh,
    };

    const command = (parsed._[0] as ParsedArguments['command'] | undefined) ?? 'open';

    switch (command) {
        case 'open':
            return {
                command: 'open',
                file: parsed.file,
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
