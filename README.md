# chaiNNer

A flowchart/node-based image processing GUI aimed at making chaining image processing tasks (especially those done by neural networks) easy, intuitive, and customizable.

No existing GUI gives you the level of customization of your image processing workflow that chaiNNer does. Not only do you have full control over your processing pipeline, you can do incredibly complex tasks just by connecting a few nodes together.

ChaiNNer is also cross-platform, meaning you can run it on Windows, MacOS, and Linux.

## Installation

Download the latest release from Github and run the installer. Simple as that.

The only dependency you need to have installed already is Python 3.7-3.9. All other dependencies can be installed via chaiNNer's dependency manager.

## GPU Support

Currently, chaiNNer's neural network support (via PyTorch) only supports Nvidia GPUs. There is currently no plan to support pre-compiled `.exe`s for NCNN processing. PyTorch also does not support GPU processing on MacOS.

## Planned Features

-   Batch/Folder/Video inputs
    -   In the future, I will be implementing the ability to iterate over items in lists. This will allow for things like batch upscaling images in a folder or upscaling every frame of a video. Unfortunately, the way I want to implement this requires a feature of `react-flow-renderer` (the library I use as the basis for all things node-related) that is still in beta. I would rather not waste my time implementing it in a jank roundabout way when I can just wait a bit longer and implement it with that new sub-flow feature.
-   Undo/Redo History
    -   Once `react-flow-renderer` updates I will have to redo how it works if I were to do it now. Also, I did try implementing this and there isn't a good way to do it currently. However, with that new update I _think_ it should be much easier to implement this.
-   More PyTorch models
-   More image processing library support
-   Much more

## FAQ

**_Why is this needed?_**

It isn't necessarily needed, I just wanted a GUI that would let me do image processing steps in any order. Also, there is currently no other cross-platform GUI for ESRGAN that I am aware of.

**_Why didn't you use embedded python or a python packager instead of relying on the system python installation?_**

First off, if you want to isolate chaiNNer from your system python, you can run it via conda. The biggest reason I didn't use a python bundler/packager is because pytorch is multiple gigabytes, which would have bloated the packaged python to an insane degree. I also noticed other issues with this, such as it taking quite a while to unpack when installing, as well as leaving huge temp files around if the installation was cancelled or failed. Embedded python is windows only, so that wasn't an option at all. Ultimately, using system python works well enough, and since conda can be used I have no concerns about it.
