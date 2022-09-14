import { exec as _exec } from 'child_process';
import semver from 'semver';
import util from 'util';

const exec = util.promisify(_exec);

export const getPythonVersion = async (python: string) => {
    const { stdout } = await exec(`"${python}" --version`);
    return semver.coerce(stdout)!.version;
};

export const isSupportedPythonVersion = (version: string) => semver.gte(version, '3.7.0');
