import { Version } from '../../common/common-types';
import { parse, versionGte } from '../../common/version';
import { promisifiedSpawn } from '../childProc';

export const getPythonVersion = async (python: string) => {
    const version = await promisifiedSpawn(python, ['--version']);
    return parse(version);
};

export const isSupportedPythonVersion = (version: Version) => versionGte(version, '3.10.0');
