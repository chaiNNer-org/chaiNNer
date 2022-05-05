import { exec as _exec } from 'child_process';
import os from 'os-utils';
import { useMemo, useState } from 'react';
import util from 'util';
import { ipcRenderer } from '../safeIpc';
import { useAsyncInterval } from './useInterval';

const exec = util.promisify(_exec);

const getCpuUsage = () =>
    new Promise<number>((resolve) => {
        os.cpuUsage((value) => {
            resolve(value * 100);
        });
    });

const getRamUsage = async () => {
    if (os.platform() === 'linux') {
        const { stdout } = await exec('free -m');
        const lines = stdout.split('\n');
        const strMemInfo = lines[1].replace(/\s+/g, ' ');
        const memInfo = strMemInfo.split(' ');

        const totalMem = parseFloat(memInfo[1]);
        const freeMem = parseFloat(memInfo[3]);

        return (1 - freeMem / totalMem) * 100;
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return (1 - freeMem / totalMem) * 100;
};

const getVRamUsage = async () => ipcRenderer.invoke('get-vram-usage');

export interface SystemUsage {
    readonly cpu: number;
    readonly ram: number;
    readonly vram: number;
}

const getSystemUsage = async (): Promise<SystemUsage> => {
    const [cpu, ram, vram] = await Promise.all([getCpuUsage(), getRamUsage(), getVRamUsage()]);
    return { cpu, ram, vram };
};

const useSystemUsage = (delay: number): SystemUsage => {
    const [usage, setUsage] = useState<SystemUsage>({ cpu: 0, ram: 0, vram: 0 });

    useAsyncInterval({ supplier: getSystemUsage, successEffect: setUsage }, delay);

    return useMemo(() => usage, [usage.cpu, usage.ram, usage.vram]);
};

export default useSystemUsage;
