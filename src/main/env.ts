import os from 'os';

export const isMac = process.platform === 'darwin';
const cpuModel = os.cpus()[0]?.model || null;
export const isArmMac: boolean = isMac && !!cpuModel && /Apple M\d/i.test(cpuModel);

const env = { ...process.env };
delete env.PYTHONHOME;
export const sanitizedEnv = env;
