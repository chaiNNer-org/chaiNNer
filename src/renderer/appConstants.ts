/**
 * Pre-loaded application constants from the main process.
 * These are loaded synchronously during preload and exposed directly to the renderer.
 * In web mode, mock constants are used instead.
 */

import { Version } from '../common/common-types';
import { isElectron } from './isElectron';
import { mockAppConstants } from './mockIpc';

export interface AppConstants {
    appVersion: Version;
    isMac: boolean;
    isArmMac: boolean;
    appDataPath: string;
}

const getConstants = (): AppConstants => {
    if (isElectron() && window.appConstants) {
        return window.appConstants;
    }
    return mockAppConstants;
};

const constants = getConstants();

export const { appVersion, isMac, isArmMac, appDataPath } = constants;
