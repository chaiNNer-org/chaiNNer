# chaiNNer

[![GitHub Latest Release](https://img.shields.io/github/v/release/joeyballentine/chaiNNer)](https://github.com/joeyballentine/chaiNNer/releases/latest)
[![GitHub Total Downloads](https://img.shields.io/github/downloads/joeyballentine/chaiNNer/total)](https://github.com/joeyballentine/chaiNNer/releases)
[![License](https://img.shields.io/github/license/joeyballentine/chaiNNer)](./LICENSE)
[![Discord](https://img.shields.io/discord/930865462852591648?label=Discord&logo=Discord&logoColor=white)](https://discord.gg/pzvAKPKyHM)

<p align="center">
  <a href="https://github.com/joeyballentine/chaiNNer/releases" target="_blank">
    <img src="src/public/banner.png" width="720" />
  </a>
</p>

A flowchart/node-based image processing GUI aimed at making chaining image processing tasks (especially upscaling done by neural networks) easy, intuitive, and customizable.

No existing upscaling GUI gives you the level of customization of your image processing workflow that chaiNNer does. Not only do you have full control over your processing pipeline, you can do incredibly complex tasks just by connecting a few nodes together.

chaiNNer is also cross-platform, meaning you can run it on Windows, MacOS, and Linux.

For help, suggestions, or just to hang out, you can join the [chaiNNer Discord server](https://discord.gg/pzvAKPKyHM)

Remember: chaiNNer is still a work in progress and in alpha. While it is slowly getting more to where we want it, it is going to take quite some time to have every possible feature we want to add. If you're knowledgeable in TypeScript, React, or Python, feel free to contribute to this project and help us get closer to that goal.

## Installation

Download the latest release from the [Github releases page](https://github.com/joeyballentine/chaiNNer/releases) and run the installer best suited for your system. Simple as that.

You don't even need to have Python installed, as chaiNNer will download an isolated integrated Python build on startup. From there, you can install all the other dependencies via the Dependency Manager.

If you do wish to use your system Python installation still, you can turn the system Python setting on. However, it is much more recommended to use the integrated Python. If you do wish to use your system Python, make sure the Python version you are using is either 3.8 or 3.9. 3.10 also should work for the most part, but it is not fully supported at this time.

If you are using the provided .zip portable version of chaiNNer, please be aware that the integrated Python it uses is not portable like the rest of it. It is located at `%appdata%/chaiNNer/python` (windows), `.config/chaiNNer/python` (linux), or `Application Support/chaiNNer/python`. We plan on making this truly portable in the future.

## How To Use

### Basic Usage

While it might seem intimidating at first due to all the possible options, chaiNNer is pretty simple to use. For example, this is all you need to do in order to perform an upscale:

<p align="center">
    <img src="src/public/simple_screenshot.png" width="480" />
</p>

Before you get to this point though, you'll need to install one of the neural network frameworks from the dependency manager. You can access this via the button in the upper-right-hand corner. ChaiNNer offers support for PyTorch (with select model architectures), NCNN, and ONNX. For Nvidia users, PyTorch will be the preferred way to upscale. For AMD users, NCNN will be the preferred way to upscale.

All the other Python dependencies are automatically installed, and chaiNNer even carries its own integrated Python support so that you do not have to modify your existing Python configuration.

Then, all you have to do is drag and drop (or double click) node names in the selection panel to bring them into the editor. Then, drag from one node handle to another to connect the nodes. Each handle is color-coded to its specific type, and while connecting will show you only the compatible connections. This makes it very easy to know what to connect where.

Once you have a working chain set up in the editor, you can press the green "run" button in the top bar to run the chain you have made. You will see the connections between nodes become animated, and start to un-animate as they finish processing. You can stop or pause processing with the red "stop" and yellow "pause" buttons respectively. Note: pressing stop is usually unable to kill an in-progress upscale during the actual upscaling step. This is a known issue without a workaround at the moment, so just be patient and wait for it to finish or restart chaiNNer.

<p align="center">
    <img src="src/public/screenshot.png" width="540" />
</p>

Don't forget, there's plenty of non-upscaling tasks you can do with chaiNNer as well!

### Tips & Tricks

To select multiple nodes, hold down shift and drag around all the nodes you want selected. You can also select an individual node by just clicking on it. When nodes are selected, you can press backspace or delete to delete them from the editor.

To batch upscale, create an Image Iterator node and drag the nodes you want to use into the iterator's editor area. You can expand the iterator by clicking and dragging the bottom right corner outwards (like you would a UI window). Simply wire up a chain in an iterator the same as you would normally, and when you click run it will run on every image in the folder you chose. You also can select an entire existing chain, and drag it into the iterator's editor area to essentially convert the entire thing into an iterable chain.

You can right-click in the editor viewport to show an inline nodes list to select from. You also can get this menu by dragging a connection out to the editor rather than making an actual connection, and it will show compatible nodes to automatically create a connection with.

### Helpful Resources

- [Kim's chaiNNer Templates](https://github.com/kimberly990/kim-chaiNNer-Templates/)
  - A collection of useful chain templates that can quickly get you started if you are still new to using chaiNNer.
- [Upscale Wiki Model Database](https://upscale.wiki/wiki/Model_Database)
  - A very nice collection of mostly ESRGAN models that have been trained for various tasks.

## Compatibility Notes

- MacOS versions older than 10.15 are not supported at this time. This is due to a major dependency (opencv) not yet having a build for this version. The next release of it should be compatible though, so stay tuned for an update that adds support for that (assuming no more compatibility issues are found).

- Windows versions 7 and below are also not supported at this time. You can attempt troubleshooting steps mentioned below in the troubleshooting section, but at this time we do not officially support more Windows versions than Microsoft does.

- Apple M1 laptops are mostly untested, though they should support almost everything. Although, ONNX is unable to be installed as it does not yet have an arm64 build, and NCNN sometimes does not work properly.

- Some NCNN users with non-Nvidia GPUs might get all-black outputs. I am not sure what to do to fix this as it appears to be due to the graphics driver crashing as a result of going out of memory. If this happens to you, try manually setting a tiling amount.

- Arch Linux users may need to manually install libxcrypt before chaiNner's integrated Python will correctly start up.

- To use the Clipboard nodes, Linux users need to have xclip or, for wayland users, wl-copy installed.

## GPU Support

For PyTorch inference, only Nvidia GPUs are supported. If you do not have an Nvidia GPU, you will have to use PyTorch in CPU mode. This is because PyTorch only support's Nvidia's CUDA. MacOS also does not support CUDA at all, so PyTorch will only work in CPU mode on MacOS.

If you have an AMD or Intel GPU that supports NCNN however, chaiNNer now supports NCNN inference. You can use any existing NCNN .bin/.param model files (only ESRGAN-related SR models have been tested), or use chaiNNer to convert a PyTorch or ONNX model to NCNN.

For NCNN, make sure to select which GPU you want to use in the settings. It might be defaulting to your integrated graphics!

For Nvidia GPUs, ONNX is also an option to be used. ONNX will use CPU mode on non-Nvidia GPUs, similar to PyTorch.

## Model Architecture Support

chaiNNer currently supports a limited amount of neural network architectures. More architectures will be supported in the future.

### Pytorch

#### Single Image Super Resolution

- [ESRGAN](https://github.com/xinntao/ESRGAN) (RRDBNet)
  - This includes regular [ESRGAN](https://github.com/xinntao/ESRGAN), [ESRGAN+](https://github.com/ncarraz/ESRGANplus), "new-arch ESRGAN" ([RealSR](https://github.com/jixiaozhong/RealSR), [BSRGAN](https://github.com/cszn/BSRGAN)), [SPSR](https://github.com/Maclory/SPSR), and [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)
- [Real-ESRGAN Compact](https://github.com/xinntao/Real-ESRGAN) (SRVGGNet)
- [Swift-SRGAN](https://github.com/Koushik0901/Swift-SRGAN)
- [SwinIR](https://github.com/JingyunLiang/SwinIR)

#### Face Restoration

- [GFPGAN](https://github.com/TencentARC/GFPGAN)
- [RestoreFormer](https://github.com/wzhouxiff/RestoreFormer)

### NCNN

- Technically, almost any SR model should work assuming they follow a typical CNN-based SR structure, however I have only tested with ESRGAN (and its variants) and with Waifu2x

### ONNX

- Similarly to NCNN, technically almost any SR model should work assuming they follow a typical CNN-based SR structure, however I have only tested with ESRGAN.

## Troubleshooting

### Has Nvidia GPU, PyTorch using CPU

- Check the dependency manager and ensure it installed the +cu113 version. If it did not, and it says CUDA supported at the top, then uninstall and reinstall PyTorch.

- Check to make sure you have the `nvidia-smi` command available to you. Open a terminal (command prompt, powershell, windows terminal) and type `nvidia-smi`. If it errors, reinstall your drivers and restart your computer.

- If chaiNNer or a terminal still isn't able to use `nvidia-smi`, try [adding your System32 folder to your PATH environment variable](https://www.computerhope.com/issues/ch000549.htm). Make sure to restart your computer after.

### Has AMD/Intel GPU, PyTorch using CPU

- PyTorch can only use Nvidia GPUs. In this case, you would want to try using NCNN as the processing framework instead. You can convert any supported PyTorch models to NCNN through chaiNNer (just be sure to also install ONNX as it is needed in the conversion process).

### Checked logs and see `CUDA_INITIALIZE` errors

- Ensure your drivers are up to date. Outdated drivers might not support the CUDA version that PyTorch and ONNX rely on.

- Ensure your GPU isn't too old. Your GPU needs to be able to support CUDA 11.3. If it only supports CUDA 10 for example, you'll need to manually install an older PyTorch version to your system Python and set chaiNNer to use system Python. However, if you do this we cannot guarantee everything will work properly.

### vkQueueSubmit error with NCNN

- If you are using an auto-tiling mode, try setting a manual number of tiles (start with 4 and work your way up until it works)

- If you are on Windows, you can try using [this](https://github.com/chaiNNer-org/chaiNNer/issues/913#issuecomment-1247849063) fix suggested by one of the NCNN devs.

### "ChaiNNer was unable to install its integrated Python environment" message or simply fails to start up

- Ensure you have access to the internet and that you did not restrict chaiNNer from accessing the internet. ChaiNNer needs internet access in order to download its Python environment and the required dependencies.

- If you do have internet access, try going to your `%appdata%/chaiNNer` (windows), `.config/chaiNNer` (linux), or `Application Support/chaiNNer` folder, and deleting the Python folder that is there. This will force chaiNNer to download Python again if the previous download was corrupt.

- If this all does not work, you can force chaiNNer to use system Python. Right now this is not configurable via the UI without being able to start up first, so you need to go to your data folder mentioned above, go to `/settings`, and either find or create a `use-system-python` text file (with no extension) that just contains the word `true`. In order for this to work, you need to have Python installed to your system.

### Integrated Python downloaded, but failed to start up after installing dependencies

- If you are on an older macOS version, such as any version below 10.15, this is unavoidable and you currently cannot use chaiNNer. This is due to a dependency (opencv) that we simply cannot work around at this time.

- If you are on Windows 7, you can try following the advice for the above message related to forcing system Python, and just install Python 3.8. However, we do not officially support Windows 7 and we recommend you upgrade to at least 10.

## Building chaiNNer Yourself

I provide pre-built versions of chaiNNer here on GitHub. However, if you would like to build chaiNNer yourself, simply run `npm install` (make sure that you have at least npm v7 installed) to install all the nodejs dependencies, and `npm run make` to build the application.

## Planned Features

- Check the Discord server for a list of planned features.

## FAQ

**What does the name mean?**

- chaiNNer is a play on the fact that you can "chain" different tasks together, with the NN in the name being a common abbreviation for Neural Networks. This is following the brilliant naming scheme of victorca25's machine learning tools (traiNNer, iNNfer, augmeNNt) which he granted me permission to use for this as well.

**Why not just use Cupscale/IEU/CLI?**

- All of these tools are viable options, but as anyone who has used them before knows they can be limited in what they can do. Many features like chaining or interpolating models are hardcoded and provide little flexibility. Certain features that would be useful, like being able to use a separate model on the alpha layer of an image for example, just do not exist in Cupscale. Inversely, you can pretty much do whatever you want with chaiNNer provided there are nodes implemented. Whatever weird feature you want implemented, you can implement yourself by connecting nodes however you want. Cupscale also does not have other image processing abilities like chaiNNer does, such as adjusting contrast.

- Cupscale and IEU are also seemingly no longer maintained at the moment, while chaiNNer is being actively worked on still.

**Wouldn't this make it more difficult to do things?**

- In a way, yes. Similarly to how programming your own script to do this stuff is more difficult, chaiNNer will also be a bit more difficult than simply dragging and dropping an image and messing with some sliders and pressing an upscale button. However, this gives you a lot more flexibility in what you can do. The added complexity is really just connecting some dots together to do what you want. That doesn't sound that bad, right?
