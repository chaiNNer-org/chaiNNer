import { exec as _exec } from 'child_process';
import log from 'electron-log';
import util from 'util';
import { Dependency } from '../../common/dependencies';
import pipInstallWithProgress from '../../common/pipInstallWithProgress';
import { ipcRenderer } from '../../common/safeIpc';

const exec = util.promisify(_exec);

export type ParsedPipList = Record<string, string>;

export const parsePipOutput = (output: string): ParsedPipList => {
    const tempPipList = output.split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
    const pipObj: ParsedPipList = {};
    tempPipList.forEach(([dep, version]) => {
        pipObj[dep] = version;
    });
    return pipObj;
};

class PipManager {
    pythonPath: string | null;

    pythonVersion: string | null;

    constructor() {
        this.pythonPath = null;
        this.pythonVersion = null;
        ipcRenderer
            .invoke('get-python')
            .then(({ python, version }) => {
                this.pythonPath = python;
                this.pythonVersion = version;
            })
            .catch((error) => {
                log.error(error);
            });
    }

    getVersion() {
        return this.pythonVersion;
    }

    async pipList() {
        const { stdout } = await exec(
            `${this.pythonPath!} -m pip list --disable-pip-version-check`
        );
        return stdout;
    }

    async parsedPipList() {
        const pipList = await this.pipList();
        return parsePipOutput(pipList);
    }

    async pipInstall(packageName: string) {
        const { stdout } = await exec(
            `${this.pythonPath!} -m pip install ${packageName} --disable-pip-version-check`
        );
        return stdout;
    }

    async pipInstallWithProgress(
        dependency: Dependency,
        onProgress: (percent: number) => void,
        onOutput: (message: string) => void = () => {},
        upgrade = false
    ) {
        return pipInstallWithProgress(this.pythonPath!, dependency, onProgress, onOutput, upgrade);
    }

    async pipUninstall(packageName: string) {
        const { stdout } = await exec(
            `${this.pythonPath!} -m pip uninstall ${packageName} -y --disable-pip-version-check`
        );
        return stdout;
    }
}

const instance = new PipManager();

export default instance;
