import os from 'os';

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
