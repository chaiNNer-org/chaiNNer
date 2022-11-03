# Troubleshooting

## After installing PyTorch, the nodes still do not show up

- This issue is still a bit of a mystery to us, but you can try a couple of things.

- Ensure you have at least 3GB of free RAM before starting chaiNNer.

- Uninstall PyTorch, restart chaiNNer, and reinstall it.

## PyTorch is failing to install from the dependency manager

- Make sure you have nothing blocking pip requests

### Windows

- Run this command in a terminal: `%appdata%/chaiNNer/python/python/python.exe -m pip install torch==1.10.2+cu113 --extra-index-url https://download.pytorch.org/whl/cu113`

### Linux

- I'm not 100% sure what the command would be on linux, but it would essentially be the same thing except with the path to whatever the equivalent of appdata is. so `linuxappdata.../chaiNNer/python/python/python3.9 -m pip install torch==1.10.2+cu113 --extra-index-url https://download.pytorch.org/whl/cu113`

## Has Nvidia GPU, PyTorch using CPU

- Check the dependency manager and ensure it installed the +cu113 version. If it did not, and it says CUDA supported at the top, then uninstall and reinstall PyTorch.

- Check to make sure you have the `nvidia-smi` command available to you. Open a terminal (command prompt, powershell, windows terminal) and type `nvidia-smi`. If it errors, reinstall your drivers and restart your computer.

- If chaiNNer or a terminal still isn't able to use `nvidia-smi`, try [adding your System32 folder to your PATH environment variable](https://www.computerhope.com/issues/ch000549.htm). Make sure to restart your computer after.

## Has AMD/Intel GPU, PyTorch using CPU

- PyTorch can only use Nvidia GPUs. In this case, you would want to try using NCNN as the processing framework instead. You can convert most supported PyTorch models to NCNN through chaiNNer (just be sure to also install ONNX as it is needed in the conversion process).

## Checked logs and see `CUDA_INITIALIZE` errors

- Ensure your drivers are up to date. Outdated drivers might not support the CUDA version that PyTorch and ONNX rely on.

- Ensure your GPU isn't too old. Your GPU needs to be able to support CUDA 11.3. If it only supports CUDA 10 for example, you'll need to manually install an older PyTorch version to your system Python and set chaiNNer to use system Python. However, if you do this we cannot guarantee everything will work properly.

## vkQueueSubmit error with NCNN

- If you are using an auto-tiling mode, try setting a manual tile size. The lower the number the more likely it will work.

- If you are on Windows, you can try using [this](https://github.com/chaiNNer-org/chaiNNer/issues/913#issuecomment-1247849063) fix suggested by one of the NCNN devs.

## "ChaiNNer was unable to install its integrated Python environment" message or simply fails to start up

- Ensure you have access to the internet and that you did not restrict chaiNNer from accessing the internet. ChaiNNer needs internet access in order to download its Python environment and the required dependencies.

- If you do have internet access, try going to your `%appdata%/chaiNNer` (windows), `.config/chaiNNer` (linux), or `Application Support/chaiNNer` folder, and deleting the Python folder that is there. This will force chaiNNer to download Python again if the previous download was corrupt.

- If this all does not work, you can force chaiNNer to use system Python. Right now this is not configurable via the UI without being able to start up first, so you need to go to your data folder mentioned above, go to `/settings`, and either find or create a `use-system-python` text file (with no extension) that just contains the word `true`. In order for this to work, you need to have Python installed to your system.

## Integrated Python downloaded, but failed to start up after installing dependencies

- If you are on an older macOS version, such as any version below 10.15, this is unavoidable and you currently cannot use chaiNNer. This is due to a dependency (opencv) that we simply cannot work around at this time.

- If you are on Windows 7, you can try following the advice for the above message related to forcing system Python, and just install Python 3.8. However, we do not officially support Windows 7 and we recommend you upgrade to at least 10.
