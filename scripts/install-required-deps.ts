/* eslint-disable no-console */
import { spawn } from 'child_process';
import { requiredDependencies } from '../src/common/dependencies';

const command = spawn('python', [
    '-m',
    'pip',
    ...requiredDependencies.map((d) => `${d.packageName}==${d.version}`),
    '--disable-pip-version-check',
]);

command.on('error', (error) => {
    console.error(error);
    process.exit(1);
});

command.on('close', (code) => {
    process.exit(code ?? 1);
});
