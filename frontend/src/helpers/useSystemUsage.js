import { spawn } from 'child_process';
import os from 'os-utils';
import { useEffect, useMemo, useState } from 'react';
import { getNvidiaSmi, getSmiQuery } from './nvidiaSmi';

const useSystemUsage = (delay) => {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [ramUsage, setRamUsage] = useState(0);
  const [vramUsage, setVramUsage] = useState(0);

  const getCpuAndRamUsage = () => {
    const totalMem = os.totalmem();
    const usedMem = os.freemem();
    const ramPercent = Number((usedMem / totalMem) * 100).toFixed(1);
    setRamUsage(ramPercent);

    os.cpuUsage((value) => {
      setCpuUsage(value * 100);
    });
  };

  useEffect(() => {
    const smiPath = getNvidiaSmi();
    if (smiPath) {
      const smiOpts = getSmiQuery(delay);
      const smi = spawn(smiPath, smiOpts.split(' '));

      // Get nvidia-smi data and parse vram info
      smi.stdout.on('data', (data) => {
        const [gpuName, vramTotal, vramUsed, vramFree] = String(data).split(', ');
        setVramUsage((Number(vramUsed) / Number(vramTotal)) * 100);
        // Use smi data event for refreshing cpu/ram if nvidia gpu
        getCpuAndRamUsage();
      });
    } else {
      // If not nvidia gpu, use interval
      setInterval(() => {
        getCpuAndRamUsage();
      }, delay);
    }
  }, []);

  return useMemo(() => ({
    cpuUsage, ramUsage, vramUsage,
  }), [cpuUsage, ramUsage, vramUsage]);
};

export default useSystemUsage;
