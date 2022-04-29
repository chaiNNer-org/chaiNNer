import { exec as _exec } from 'child_process';
import { ipcRenderer } from 'electron';
import os from 'os-utils';
import { useEffect, useMemo, useState } from 'react';
import util from 'util';
import useInterval from './useInterval';

const exec = util.promisify(_exec);

const useSystemUsage = (delay: number) => {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [ramUsage, setRamUsage] = useState(0);
  const [vramUsage, setVramUsage] = useState(0);

  const setInfo = async () => {
    // RAM
    if (os.platform() === 'linux') {
      const { stdout } = await exec('free -m');
      const lines = stdout.split('\n');
      const strMemInfo = lines[1].replace(/[\s\n\r]+/g, ' ');
      const memInfo = strMemInfo.split(' ');

      const totalMem = parseFloat(memInfo[1]);
      const freeMem = parseFloat(memInfo[3]);

      const ramPercent = ((1 - freeMem / totalMem) * 100).toFixed(1);
      setRamUsage(Number(ramPercent));
    } else {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const ramPercent = ((1 - freeMem / totalMem) * 100).toFixed(1);
      setRamUsage(Number(ramPercent));
    }

    // CPU
    os.cpuUsage((value) => {
      setCpuUsage(value * 100);
    });

    // GPU/VRAM
    try {
      const vramPercent = Number(await ipcRenderer.invoke('get-vram-usage'));
      setVramUsage(vramPercent);
    } catch (_) {
      // Sometimes this will fire before it's done registering the event handlers
    }
  };

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      // We set this up on mount, letting the main process handle it
      // By doing it this way we avoid spawning multiple smi shells
      await ipcRenderer.invoke('setup-vram-checker-process', delay);
      await setInfo();
    })();
  }, []);

  useInterval(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      await setInfo();
    })();
  }, delay);

  return useMemo(() => ({ cpuUsage, ramUsage, vramUsage }), [cpuUsage, ramUsage, vramUsage]);
};

export default useSystemUsage;
