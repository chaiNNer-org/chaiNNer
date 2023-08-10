import os from 'os';
import path from 'path';

export const isWindows = process.platform === 'win32';
export const isMac = process.platform === 'darwin';

const cpuModel = os.cpus()[0]?.model || null;
export const isArmMac: boolean = isMac && !!cpuModel && /Apple M\d/i.test(cpuModel);

export const isRenderer = typeof process !== 'undefined' && process.type === 'renderer';

export const pathVar = process.env.path?.split(os.platform() === 'win32' ? ';' : ':');
export const altPathVarLinux = process.env.LD_LIBRARY_PATH?.split(':');
export const hasTensorRtWindows =
    // lib env var
    pathVar?.some((p) => p.includes('TensorRT') && p.includes('lib') && !p.includes('cudnn')) &&
    // cudnn lib env var
    pathVar.some((p) => p.includes('TensorRT') && p.includes('lib') && p.includes('cudnn'));

export const hasTensorRtLinux =
    // lib env var
    pathVar?.some((p) => p.includes('TensorRT') && p.includes('lib')) ||
    altPathVarLinux?.some((p) => p.includes('TensorRT') && p.includes('lib'));

export const hasTensorRt = !isMac && (hasTensorRtWindows || hasTensorRtLinux);

const env = { ...process.env };
delete env.PYTHONHOME;
export const sanitizedEnv = env;

export const getCacheLocation = (userDataPath: string, cacheKey: string) => {
    return path.join(userDataPath, cacheKey);
};
