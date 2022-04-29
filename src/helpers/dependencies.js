const isMac = process.platform === 'darwin';

export default (isNvidiaAvailable) => [
  {
    name: 'OpenCV',
    packageName: 'opencv-python',
    version: '4.5.5.64',
  },
  {
    name: 'NumPy',
    packageName: 'numpy',
    version: '1.22.3',
  },
  {
    name: 'PyTorch',
    packageName: 'torch',
    version: `1.10.2+${isNvidiaAvailable && !isMac ? 'cu113' : 'cpu'}`,
    findLink: `https://download.pytorch.org/whl/${
      isNvidiaAvailable && !isMac ? 'cu113' : 'cpu'
    }/torch_stable.html`,
  },
  {
    name: 'NCNN',
    packageName: 'ncnn-vulkan',
    version: '2022.4.1',
  },
  {
    name: 'Pillow (PIL)',
    packageName: 'Pillow',
    version: '9.1.0',
  },
];
