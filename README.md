# chaiNNer

A flowchart/node-based image processing GUI aimed at making chaining image processing tasks (especially those done by neural networks) easy, intuitive, and customizable.

No existing GUI gives you the level of customization of your image processing workflow that chaiNNer does. Not only do you have full control over your processing pipeline, you can do incredibly complex tasks just by connecting a few nodes together.

ChaiNNer is also cross-platform, meaning you can run it on Windows, MacOS, and Linux.

## Installation

Download the latest release from Github and run the installer. Simple as that.

The only dependency you need to have installed already is Python 3.7-3.9. All other dependencies can be installed via chaiNNer's dependency manager.

## GPU Support

Currently, chaiNNer's neural network support (via PyTorch) only supports Nvidia GPUs. There is currently no plan to support pre-compiled `.exe`s for NCNN processing. PyTorch also does not support GPU processing on MacOS.
