import log from 'electron-log';
import { PythonInfo } from '../../common/common-types';
import { getPythonVersion, isSupportedPythonVersion } from './version';

export const checkPythonPaths = async (pythonsToCheck: string[]): Promise<PythonInfo> => {
    for (const py of pythonsToCheck) {
        // eslint-disable-next-line no-await-in-loop
        const version = await getPythonVersion(py).catch((err) => {
            log.error(err);
        });
        if (version && isSupportedPythonVersion(version)) {
            return { python: py, version };
        }
    }

    throw new Error(
        `No Python binaries in [${pythonsToCheck.join(', ')}] found or supported version (3.8+)`
    );
};
