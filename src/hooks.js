// const fs = require('fs');
// const path = require('path');
// const Downloader = require('nodejs-file-downloader');
// const os = require('os');
// const decompress = require('decompress');
// const { execSync } = require('child_process');

// const downloads = {
//   python: {
//     linux: 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-unknown-linux-gnu-install_only-20211017T1616.tar.gz',
//     darwin: 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-apple-darwin-install_only-20211017T1616.tar.gz',
//     win32: 'https://github.com/indygreg/python-build-standalone/releases/download/20211017/cpython-3.9.7-x86_64-pc-windows-msvc-shared-install_only-20211017T1616.tar.gz',
//   },
// };

module.exports = {
  // prePackage: async (forgeConfig, options) => {
  //   const platform = os.platform();
  //   const url = downloads.python[platform];
  //   if (fs.existsSync('./backend/python.zip')) {
  //     return;
  //   }
  //   const downloader = new Downloader({
  //     url,
  //     directory: './backend/python',
  //     fileName: 'python.tar.gz',
  //   });
  //   try {
  //     await downloader.download();
  //     const fileData = await decompress('./backend/python/python.tar.gz');
  //     // eslint-disable-next-line no-restricted-syntax
  //     for (const file of fileData) {
  //       const filePath = path.join('./backend/python', file.path);
  //       const fileDir = path.dirname(filePath);
  //       fs.mkdirSync(fileDir, { recursive: true });
  //       fs.writeFileSync(filePath, file.data);
  //     }
  //     fs.rmSync('./backend/python/python.tar.gz');
  //
  //     let pythonPath;
  //     switch (platform) {
  //       case 'win32':
  //         pythonPath = path.resolve('./backend/python/python/python.exe');
  //         break;
  //       case 'linux':
  //         pythonPath = path.resolve('./backend/python/python/bin/python3');
  //         break;
  //       case 'darwin':
  //         pythonPath = path.resolve('./backend/python/python/bin/python3');
  //         break;
  //       default:
  //         break;
  //     }
  //
  //     execSync(`${pythonPath} -m pip install --upgrade pip`);
  //     execSync(
  //       `${pythonPath} -m pip install sanic==21.9.3 Sanic-Cors==1.0.1 --no-warn-script-location`
  //     );
  //
  //     console.log('All done');
  //   } catch (error) {
  //     console.log('Download failed', error);
  //   }
  // },
};
