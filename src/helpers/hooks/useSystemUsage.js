import { ipcRenderer } from 'electron';
import os from 'os-utils';
import { useEffect, useMemo, useState } from 'react';
import useInterval from './useInterval';

const useSystemUsage = (delay) => {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [ramUsage, setRamUsage] = useState(0);
  const [vramUsage, setVramUsage] = useState(0);

  const setInfo = async () => {
    // RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramPercent = Number((1 - (freeMem / totalMem)) * 100).toFixed(1);
    setRamUsage(ramPercent);

    // CPU
    os.cpuUsage((value) => {
      setCpuUsage(value * 100);
    });

    // GPU/VRAM
    try {
      const vramPercent = await ipcRenderer.invoke('get-vram-usage');
      setVramUsage(vramPercent);
    } catch (_) {
      // Sometimes this will fire before it's done registering the event handlers
    }
  };

  useEffect(() => {
    (async () => {
    // We set this up on mount, letting the main process handle it
    // By doing it this way we avoid spawning multiple smi shells
      await ipcRenderer.invoke('setup-vram-checker-process', delay);
      await setInfo();
    })();
  }, []);

  useInterval(async () => {
    await setInfo();
  }, delay);

  return useMemo(() => ({
    cpuUsage, ramUsage, vramUsage,
  }), [cpuUsage, ramUsage, vramUsage]);
};

export default useSystemUsage;
