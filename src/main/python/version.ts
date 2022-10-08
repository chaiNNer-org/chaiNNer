import { exec as _exec } from 'child_process';
import util from 'util';
import { Version } from '../../common/common-types';
import { parse, versionGte } from '../../common/version';

const exec = util.promisify(_exec);

export const getPythonVersion = async (python: string) => {
    const { stdout } = await exec(`"${python}" --version`);
    return parse(stdout);
};

export const isSupportedPythonVersion = (version: Version) => versionGte(version, '3.7.0');
