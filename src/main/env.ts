import os from 'os';

export const isMac = process.platform === 'darwin';
const cpuModel = os.cpus()[0]?.model || null;
export const isArmMac: boolean = isMac && !!cpuModel && /Apple M\d/i.test(cpuModel);

const env = { ...process.env };
delete env.PYTHONHOME;
// Disable user site-packages to prevent chaiNNer from using global Python packages
// This ensures packages are installed in chaiNNer's isolated environment
env.PYTHONNOUSERSITE = '1';
export const sanitizedEnv = env;
