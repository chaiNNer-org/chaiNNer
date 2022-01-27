import { spawn } from 'child_process';
import decompress from 'decompress';
import log from 'electron-log';
import fs from 'fs';
import Downloader from 'nodejs-file-downloader';
import os from 'os';
import path from 'path';
import downloads from './downloads';

export const downloadPython = async (directory, onProgress) => {
  const platform = os.platform();
  const url = downloads.python[platform];

  const downloader = new Downloader({
    url,
    directory,
    fileName: 'python.tar.gz',
    // (percentage, chunk, remainingSize)
    onProgress,
  });
  try {
    await downloader.download();
  } catch (error) {
    console.log(error);
  }
};

export const extractPython = async (directory, onProgress) => {
  const fileData = Array.from(await decompress(path.join(directory, '/python.tar.gz')));
  const totalFiles = fileData.length;
  fileData.forEach((file, i) => {
    const filePath = path.join(directory, file.path);
    const fileDir = path.dirname(filePath);
    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(filePath, file.data);
    const percentageComplete = (i / totalFiles) * 100;
    onProgress(percentageComplete);
  });
  fs.rmSync(path.join(directory, '/python.tar.gz'));
};

// TODO: figure out if I can make this work properly
// |################################| 336 kB 3.3 MB/s
const getPipPercentFromData = (data) => {
  try {
    const dataString = String(data);
    const regexp = /\|(#*).*\|\s*([0-9]*\s?.B)?/g;
    const matches = [...dataString.matchAll(regexp)];
    // eslint-disable-next-line no-unused-vars
    const [fullMatch, hashes, size] = matches[0];
    // Length of the pip install progress bar is 32
    return (hashes.length / 32) * 100;
  } catch (error) {
    return 0;
  }
};

const upgradePip = async (pythonPath, onProgress) => new Promise((resolve, reject) => {
  const pipUpgrade = spawn(pythonPath, '-m pip install --upgrade pip --no-warn-script-location --progress-bar ascii --no-cache-dir'.split(' '));
  pipUpgrade.stdout.on('data', (data) => {
    onProgress(getPipPercentFromData(data));
  });
  pipUpgrade.stderr.on('data', (data) => {
    log.error(`Error updating pip: ${String(data)}`);
    reject(new Error(`Error updating pip: ${String(data)}`));
  });
  pipUpgrade.on('close', () => {
    resolve();
  });
});

const pipInstallSanic = async (pythonPath, onProgress) => new Promise((resolve, reject) => {
  const pipUpgrade = spawn(pythonPath, '-m pip install sanic==21.9.3 Sanic-Cors==1.0.1 --no-warn-script-location --progress-bar ascii --no-cache-dir'.split(' '));
  pipUpgrade.stdout.on('data', (data) => {
    onProgress(getPipPercentFromData(data));
  });
  pipUpgrade.stderr.on('data', (data) => {
    log.error(`Error updating pip: ${String(data)}`);
    reject(new Error(`Error updating pip: ${String(data)}`));
  });
  pipUpgrade.on('close', () => {
    resolve();
  });
});

export const installSanic = async (pythonPath) => {
  await upgradePip(pythonPath, () => {});
  await pipInstallSanic(pythonPath, () => {});
};
