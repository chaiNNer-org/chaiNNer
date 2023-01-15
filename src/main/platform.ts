import { app } from 'electron';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { checkFileExists } from '../common/util';

export type SupportedPlatform = 'linux' | 'darwin' | 'win32';

export const getPlatform = (): SupportedPlatform => {
    const platform = os.platform();
    switch (platform) {
        case 'win32':
        case 'linux':
        case 'darwin':
            return platform;
        default:
            throw new Error(
                `Unsupported platform: ${platform}. Please report this to us and we may add support.`
            );
    }
};

export const currentExecutableDir = path.dirname(app.getPath('exe'));

export const getIsPortable = async (): Promise<boolean> => {
    const isPortable = await checkFileExists(path.join(currentExecutableDir, 'portable'));
    return isPortable;
};

export const getRootDir = async (): Promise<string> => {
    const isPortable = await getIsPortable();
    const rootDir = isPortable ? currentExecutableDir : app.getPath('userData');
    return rootDir;
};

export const getIsPortableSync = (): boolean => {
    const isPortable = existsSync(path.join(currentExecutableDir, 'portable'));
    return isPortable;
};

export const getRootDirSync = (): string => {
    const isPortable = getIsPortableSync();
    const rootDir = isPortable ? currentExecutableDir : app.getPath('userData');
    return rootDir;
};
