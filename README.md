# chaiNNer

![GitHub Latest Release](https://img.shields.io/github/v/release/joeyballentine/chaiNNer) ![GitHub Total Downloads](https://img.shields.io/github/downloads/joeyballentine/chaiNNer/total) ![License](https://img.shields.io/github/license/joeyballentine/chaiNNer) ![Discord](https://img.shields.io/discord/930865462852591648?label=Discord&logo=Discord&logoColor=white)

<p align="center">
    <img src="src/public/chaiNNer screenshot.png" width="600" />
</p>

A flowchart/node-based image processing GUI aimed at making chaining image processing tasks (especially those done by neural networks) easy, intuitive, and customizable.

No existing GUI gives you the level of customization of your image processing workflow that chaiNNer does. Not only do you have full control over your processing pipeline, you can do incredibly complex tasks just by connecting a few nodes together.

chaiNNer is also cross-platform, meaning you can run it on Windows, MacOS, and Linux.

For help, suggestions, or just to hang out, you can join the [chaiNNer Discord server](https://discord.gg/pzvAKPKyHM)

## Installation

Download the latest release from Github and run the installer. Simple as that.

The only dependency you need to have installed already is Python 3.7-3.9. All other dependencies can be installed via chaiNNer's dependency manager.

## Building

To build, run `npm install` to install, and `npm run make` to build the application.

## GPU Support

Currently, chaiNNer's neural network support (via PyTorch) only supports Nvidia GPUs. There is currently no plan to support pre-compiled `.exe`s for NCNN processing. PyTorch also does not support GPU processing on MacOS.

## Planned Features

**Embedded Python**

> I'm currently figuring out the best way to add this in. There are standalone python binaries for every platform that I plan on supporting. I am still just trying to figure out whether it should be downloaded and installed to on first run, or if all that should be done in the build action and bundled with the installer.

**NCNN**

> Once the python api for NCNN supports GPU, I will be adding the ability to convert from PyTorch to TorchScript to ONNX to NCNN. It'll be a bit convoluted but it'll allow AMD support I think

**PIL & Wand**

> I do plan on adding support for PIL and Wand for image processing.

**Batch Processing**

> I am waiting to add this until the node-graph library I use supports nested flows (which is coming relatively soon). The way I will be doing this will be similar to how for loops work, in that you will have iterator panels that will iterate over some sort of loaded array of items (i.e. folder input or frames of a video)

**Undo History, Copy & Paste**

> For now I am having difficulty adding these in. I plan on revisiting this later after I am forced to refactor my implementation due to the node-graph library I use releasing breaking changes soon.

**Drag and Drop Images**

> This is planned, ideally for both dragging into the file selection box and onto the window to make a new image read node

**Presets**

> Some things that are common tasks should have presets you can drag in, that are basically just multiple nodes packaged together

**More SR Networks, More Image Processing Libraries**

> What the title says

**Live Updating**

> This is something that will be a bit complex to do, but basically I'd like to have a mode where it constantly is running and refreshing on any node change, and displays previews of each node

## FAQ

**What does the name mean?**

> chaiNNer is a play on the fact that you can "chain" different tasks together, with the NN in the name being a common abbreviation for Neural Networks. This is following the brilliant naming scheme of victorca25's machine learning tools (traiNNer, iNNfer, augmeNNt) which he granted me permission to use for this as well.

**Why not just use Cupscale/IEU/CLI?**

> All of these tools are viable options, but as anyone who has used them before knows, they can be limited in what it can do, as many features like chaining or interpolating models are hardcoded in and provide little flexibility. Certain features that would be useful, like being able to use a separate model on the alpha layer of an image, just do not exist in Cupscale, for example. Inversely, you can pretty much do whatever you want with chaiNNer provided there are nodes implemented. Whatever weird feature you want implemented, you can implement yourself by connecting nodes however you want. Cupscale also does not have other image processing abilities like chaiNNer does, such as adjusting contrast.

**Wouldn't this make it more difficult to do things?**

> In a way, yes. Similarly to how programming your own script to do this stuff is more difficult, chaiNNer will also be a bit more difficult than simply dragging and dropping and image and messing with some sliders and pressing an upscale button. However, this gives you a lot more flexibility in what you can do. The added complexity is really just connecting some dots together to do what you want. That doesn't sound that bad, right?

**What platforms are supported?**

> Windows, Linux, and MacOS are all supported by chaiNNer. However, MacOS currently lacks GPU support for pytorch, so I highly recommend using another OS if you need that functionality.
