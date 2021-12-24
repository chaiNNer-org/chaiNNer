const isMac = process.platform === 'darwin';

export default (isNvidiaAvailable) => [{
  name: 'OpenCV',
  packageName: 'opencv-python',
  installCommand: 'pip install opencv-python',
}, {
  name: 'NumPy',
  packageName: 'numpy',
  installCommand: 'pip install numpy',
}, {
  name: 'PyTorch',
  packageName: 'torch',
  installCommand: `pip install torch==1.10.1+${isNvidiaAvailable && !isMac ? 'cu113' : 'cpu'} -f https://download.pytorch.org/whl/${isNvidiaAvailable && !isMac ? 'cu113' : 'cpu'}/torch_stable.html`,
}];
