# Contributing

## Getting Started

1. Fork the repository on GitHub
2. Clone the forked repository to your local machine
3. Install the dependencies of the frontend with `npm ci`
4. Install the dev dependencies of the backend with `pip install -r requirements.txt`
5. Install the dependencies of the backend with `python ./backend/src/run.py --close-after-start --install-builtin-packages`. The backend will install all of its dependencies with this command, including torch. This can take a while, so be patient.

ChaiNNer is an Electron application that uses Python for the backend. The frontend and backend communicate through a JSON API. The frontend is located in the `src` folder and the backend is located in the `backend` folder.

We use VSCode as our IDE of choice, and we strongly recommend you to do the same. We have included the `.vscode` folder in this repository, which contains some settings that make developing chaiNNer easier.

## Running the Application

There are 2 way to run chaiNNer:

1. Use `npm run dev` to run the application in development mode. This will run the frontend and backend in parallel. The frontend will be reloaded automatically when you make changes to the code. The backend will be reloaded automatically when you make changes to the code and restart the frontend.

    This also allows for debugging. You can attach a debugger to the backend by using the `Attach Debugger to chaiNNer` launch configuration in VSCode. This allows you to set breakpoints in backend code.

    Note: The backend will use your system python in this mode. This means that you might need to (re)install some dependencies using chaiNNer's dependency manager.

1. Use `npm start` to run the application in production mode. The frontend will automatically start and manage the backend process. The frontend will be reloaded automatically when you make changes to the code. The backend will **NOT** be reloaded automatically, use `npm run dev` if you need this.

    NOTE: ChaiNNer will use its own python installation, the same that a regular installation of chaiNNer also uses.

Generally, use `npm run dev` when you want to develop the backend or the frontend, and use `npm start` you want to start chaiNNer in a more production-like mode.

## Useful commands

The following commands will only work after you have installed the dependencies of the frontend and the backend, so be sure to follow [Getting Started](#getting-started).

-   `npm run dev` & `npm start` - See [Running the Application](#running-the-application)
-   `npm run lint` - Runs the linter on the frontend and backend code.
-   `npm run lint:fix` - Runs the linter on the frontend and backend code and fixes all fixable errors. This includes formatting, sorting imports, etc.
-   `npm run test` - Runs the tests.
-   `npm run test:update` - Runs the tests and updates any outdated snapshots.

## Project structure

The project is split into 2 parts: the frontend and the backend. The frontend is located in the `src` folder and the backend is located in the `backend` folder.

### Frontend

The frontend is an Electron application written in TypeScript. As such, the frontend is split into 3 parts:

1. The code for the main Node.js electron process, which is located in `src/main`.
2. The code for the renderer process, which is located in `src/renderer`. This is the web part of the application. We use React and Chakra UI for the frontend.
3. The code for the shared code between the main and renderer process, which is located in `src/common`.

### Backend

The backend is a Python application. The backend is roughly split into 3 parts:

1. `backend/src/packages` contains the packages that contain chaiNNer's nodes. Most nodes are in the `chaiNNer_standard` package.
2. `backend/src/nodes` contains logic shared between nodes. This includes common functionality for task such as upscaling, classes to define inputs and outputs, etc.
3. The rest of `backend/src` contains the code that glues everything together. This includes the code that defines the JSON API, the code that manages the nodes, the node executor, etc.

## Adding a new node

In this section, we will go through the process of adding a new node to an existing package. As an illustrative example, we will add the Gaussian Blur node.

Firstly, we need to determine where to put the file of the node. Nodes are organized into package, categories, and node groups.

-   A package is a collection of nodes with similar dependencies. E.g. all NCNN nodes are in the `chaiNNer_ncnn` package. All packages are located at `backend/src/packages/`.

    In our case, we will use [OpenCV's `cv2.GaussianBlur`](https://docs.opencv.org/4.x/d4/d86/group__imgproc__filter.html#gaabe8c836e97159a9193fb0b11ac52cf1) function to implement the Gaussian Blur node. So we will choose the `chaiNNer_standard` package, because it includes OpenCV as a dependencies.

-   Categories are used to structure nodes in the UI. Packages can contain multiple categories. E.g. the `chaiNNer_standard` package contains the `Image` and `Utility` categories. Categories are defined in the `__init__.py` file of the package.

    In our case, we will add the Gaussian Blur node to the `Image (Filters)` category.

-   Node groups are used to group nodes within a category. Categories can contain multiple node groups. E.g. the `Image (Filters)` category contains the `Blur`, `Sharpen`, and `Noise` node groups. Node groups are typically defined in `<package>/<category>/__init__.py`.

    In our case, we will add the Gaussian Blur node to the `Blur` node group.

_Note:_ In this example, we will add the new node to an existing category and node group, but you may need to create new categories and node groups for your specific node. This is rather simple, so just follow the structure of the existing categories and node groups.

With package, category, and node group clear, we can now create the file for our node. The file should be located at `backend/src/packages/<package>/<category>/<node_group>/<node_name>.py`. In our case, this is `backend/src/packages/chaiNNer_standard/image_filter/blur/gaussian_blur.py`.

Let's implement the node:

```python
# gaussian_blur.py
import cv2
import numpy as np

def gaussian_blur_node(img: np.ndarray, radius: float) -> np.ndarray:
    return cv2.GaussianBlur(img, (0, 0), sigmaX=radius, sigmaY=radius)
```

The implementation is rather simple, we take an image and a radius as input, and return the blurred image as output.

Now let's register this function as node, so chaiNNer can use it. We need to import our node group, in this case the `Blur` node group, and use its `register` function as a decorator like this:

```python
# gaussian_blur.py
import cv2
import numpy as np

from .. import blur_group

@blur_group.register(
    # TODO: Add metadata here
)
def gaussian_blur_node(img: np.ndarray, radius: float) -> np.ndarray:
    return cv2.GaussianBlur(img, (0, 0), sigmaX=radius, sigmaY=radius)
```

`register` requires that we supply metadata, so let's add it. We need a name, a description, an icon, and we need to declare all inputs and outputs.

```python
# gaussian_blur.py
import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import blur_group


@blur_group.register(
    schema_id="chainner:image_filter:gaussian_blur",
    name="Gaussian Blur",
    description="Apply Gaussian blur to an image.",
    icon="MdBlurOn",
    inputs=[
        ImageInput(),
        NumberInput("Radius", minimum=0, default=2, precision=1),
    ],
    outputs=[
        ImageOutput(image_type="Input0"),
    ],
)
def gaussian_blur_node(img: np.ndarray, radius: float) -> np.ndarray:
    return cv2.GaussianBlur(img, (0, 0), sigmaX=radius, sigmaY=radius)
```

Let's go through the metadata:

-   `schema_id` is a unique identifier for the node. The schema ID currently doesn't have a defined format, but we typically use `chainner:<category>:<node_name>`. In our example, we use `chainner:image_filter:gaussian_blur`.
-   `name`, `description`, and `icon` are all displayed in the UI.
-   `inputs` declares all arguments of the python function. In our case, we have 2 inputs: `img` and `radius`. `ImageInput` and `NumberInput` are classes that define the type of the input. `ImageInput` is used for images, and `NumberInput` is used for numbers. `NumberInput` takes a few arguments. `minimum` and `maximum` define the range of the number, `default` defines the default value, and `precision` defines the number of decimal places.
-   `outputs` declares all return values of the python function. In our case, we return one image. `ImageOutput` is used for images. `image_type="Input0"` means that the output image has the same size and number of channels as the input image.

For more information about metadata, see the [Node Metadata docs](docs/nodes.md#node-metadata).

And that's it. We have successfully implemented a new node. Now we can start chaiNNer and see our new node in action.

For more information about nodes, see [the nodes documentation](docs/nodes.md).
