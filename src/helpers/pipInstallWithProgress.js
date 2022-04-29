const { spawn, execSync } = require('child_process');
const Downloader = require('nodejs-file-downloader');
const { URL } = require('url');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const log = require('electron-log');

const tempDir = os.tmpdir();

const stringIsAValidUrl = (s) => {
  try {
    // eslint-disable-next-line no-unused-vars
    const url = new URL(s);
    return true;
  } catch (_) {
    return false;
  }
};

const downloadWheelAndInstall = async (pythonPath, url, fileName, onProgress, onOutput) =>
  new Promise((resolve, reject) => {
    let lastProgressNum = null;
    const downloader = new Downloader({
      url,
      directory: tempDir,
      fileName,
      // (percentage, chunk, remainingSize)
      onProgress: (percentage) => {
        // console.log(`${percentage}%`);
        const progressNum = Math.floor(Number(percentage));
        if (progressNum % 5 === 0 && lastProgressNum !== progressNum) {
          onOutput(`Download at: ${progressNum}%\n`);
          lastProgressNum = progressNum;
        }
        onProgress(Number(percentage) * 0.9 + 1);
      },
    });

    try {
      downloader.download().then(() => {
        onProgress(98);
        onOutput('Installing package from whl...\n');
        const installProcess = spawn(pythonPath, [
          '-m',
          'pip',
          'install',
          path.join(tempDir, fileName),
        ]);
        installProcess.stdout.on('data', (data) => {
          onOutput(String(data));
        });
        installProcess.on('close', () => {
          onProgress(99);
          fs.rmSync(path.join(tempDir, fileName));
          // onOutput('Temp files removed.\n');
          onProgress(100);
          resolve();
        });
      });
    } catch (error) {
      log.error(error);
      reject(error);
    }
  });

const pipInstallWithProgress = async (
  python,
  dep,
  onProgress = () => {},
  onOutput = () => {},
  upgrade = false
) =>
  new Promise((resolve, reject) => {
    log.info('Beginning pip install...');
    onProgress(0);
    let args = [
      'install',
      ...(upgrade ? ['--upgrade'] : []),
      `${dep.packageName}==${dep.version}`,
      '--disable-pip-version-check',
    ];
    if (dep.findLink) {
      args = [...args, '-f', dep.findLink, '--disable-pip-version-check'];
    }
    const pipRequest = spawn(python, ['-m', 'pip', ...args]);

    pipRequest.stdout.on('data', async (data) => {
      const stringData = String(data);
      onOutput(stringData);
      const wheelRegex = /([^\s\\]*)[.]whl/g;
      const matches = stringData.match(wheelRegex);
      if (matches) {
        const [wheelFileName] = matches;
        pipRequest.kill();
        onProgress(1);
        log.info(`Found whl: ${wheelFileName}`);

        if (stringIsAValidUrl(wheelFileName)) {
          const wheelName = wheelFileName.split('/').slice(-1)[0];
          await downloadWheelAndInstall(
            python,
            wheelFileName,
            wheelName,
            onProgress,
            onOutput
          ).then(() => {
            resolve();
          });
        } else {
          const req = https.get(`https://pypi.org/pypi/${dep.packageName}/json`, (res) => {
            let output = '';

            res.on('data', (d) => {
              output += String(d);
            });

            res.on('close', () => {
              if (output) {
                const releases = Array.from(JSON.parse(output).releases[dep.version]);
                if (releases) {
                  const { url } = releases.find((file) => file.filename === wheelFileName);
                  onOutput(`Downloading package from PyPi at: ${url}\n`);
                  // console.log('Wheel URL found: ', url);
                  downloadWheelAndInstall(python, url, wheelFileName, onProgress, onOutput).then(
                    () => {
                      resolve();
                    }
                  );
                }
              }
            });
          });

          req.on('error', (error) => {
            log.error(error);
            log.error('Error installing normal way, resorting to generic pip install.');
            const result = execSync(`${python} -m pip ${args.join(' ')}`);
            resolve(result);
          });

          req.end();
        }
      }
    });

    pipRequest.stderr.on('data', () => {
      // console.log(String(data));
    });

    pipRequest.on('error', (error) => {
      log.error(error);
      reject(error);
    });

    pipRequest.on('close', (code) => {
      if (code === 0) {
        resolve();
      }
    });
  });

export default pipInstallWithProgress;
