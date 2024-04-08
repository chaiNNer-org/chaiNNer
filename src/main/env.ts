import os from 'os';
import path from 'path';

export const isRenderer = typeof process !== 'undefined' && process.type === 'renderer';

export const isMac = process.platform === 'darwin';
const cpuModel = os.cpus()[0]?.model || null;
export const isArmMac: boolean = isMac && !!cpuModel && /Apple M\d/i.test(cpuModel);

const env = { ...process.env };
delete env.PYTHONHOME;
export const sanitizedEnv = env;

export const getCacheLocation = (userDataPath: string, cacheKey: string) => {
    return path.join(userDataPath, '/cache/', cacheKey);
};
