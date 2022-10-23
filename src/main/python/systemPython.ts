import { LocalStorage } from 'node-localstorage';
import { PythonInfo } from '../../common/common-types';
import { getPythonVersion, isSupportedPythonVersion } from './version';

export const getSystemPython = async (localStorageLocation: string): Promise<PythonInfo> => {
    const localStorage = new LocalStorage(localStorageLocation);
    const systemPythonLocation = localStorage.getItem('system-python-location');

    // CASE: system python location is not set
    for (const py of [systemPythonLocation, 'python', 'python3']) {
        if (py) {
            // eslint-disable-next-line no-await-in-loop
            const version = await getPythonVersion(py).catch(() => null);
            if (version && isSupportedPythonVersion(version)) {
                return { python: py, version };
            }
        }
    }

    throw new Error('System Python binary not found or unsupported version');
};
