import { spawn } from 'child_process';

export const promisifiedSpawn = async (command: string, args: string[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => {
            stdout += data;
        });
        proc.stderr.on('data', (data) => {
            stderr += data;
        });
        proc.on('error', (err) => {
            reject(err);
        });
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr));
            } else {
                resolve(stdout);
            }
        });
    });
};
