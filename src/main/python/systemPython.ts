import { PythonInfo } from '../../common/common-types';
import { getPythonVersion, isSupportedPythonVersion } from './version';

export const getSystemPython = async (): Promise<PythonInfo> => {
    for (const py of ['python', 'python3']) {
        // eslint-disable-next-line no-await-in-loop
        const version = await getPythonVersion(py).catch(() => null);
        if (version && isSupportedPythonVersion(version)) {
            return { python: py, version };
        }
    }

    throw new Error('System Python binary not found or unsupported version');
};
