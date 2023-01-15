import yargs from 'yargs/yargs';
import { assertNever } from '../common/util';

interface ArgumentOptions {
    noBackend: boolean;
}
export interface OpenArguments extends ArgumentOptions {
    command: 'open';
    file: string | undefined;
}
export interface RunArguments extends ArgumentOptions {
    command: 'run';
    file: string;
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
                return y.positional('file', {
                    type: 'string',
                    description: 'The chain to run. This should be a .chn file',
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
        })
        .strict()
        .parseSync();

    const options: ArgumentOptions = {
        noBackend: !parsed.backend,
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
                ...options,
            };
        default:
            return assertNever(command);
    }
};
