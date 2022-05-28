/* eslint-disable no-console */
import { spawn } from 'child_process';
import { requiredDependencies } from '../src/common/dependencies';

try {
    const command = spawn('python', [
        '-m',
        'pip',
        ...requiredDependencies.map((d) => `${d.packageName}==${d.version}`),
        '--disable-pip-version-check',
    ]);

    command.stdout.on('data', (data: unknown) => {
        console.log(String(data));
    });

    command.stderr.on('data', (data: unknown) => {
        console.error(String(data));
    });

    command.on('error', (error) => {
        console.error(error);
        process.exit(1);
    });

    command.on('close', (code) => {
        process.exit(code ?? 1);
    });
} catch (error) {
    console.error(String(error));
}
