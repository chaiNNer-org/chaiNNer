# Contributing

## Getting Started

1. Fork the repository on GitHub
2. Clone the forked repository to your local machine
3. Install the dependencies of the frontend with `npm ci`
4. Install the dependencies of the backend with `pip install -r requirements.txt`

ChaiNNer is an Electron application that uses Python for the backend. The frontend and backend communicate through a JSON API. The frontend is located in the `src` folder and the backend is located in the `backend` folder.

We use VSCode as our IDE of choice, and we strongly recommend you to do the same. We have included the `.vscode` folder in this repository, which contains some settings that make developing chaiNNer easier.

## Running the Application

There are 2 way to run chaiNNer:

1. Use `npm run dev` to run the application in development mode. This will run the frontend and backend in parallel. The frontend will be reloaded automatically when you make changes to the code. The backend will be reloaded automatically when you make changes to the code and restart the frontend.

    Note: The backend will use your system python in this mode. This means that you might need to (re)install some dependencies using chaiNNer's dependency manager.

1. Use `npm start` to run the application in production mode. The frontend will automatically start and manage the backend process. The frontend will be reloaded automatically when you make changes to the code. The backend will **NOT** be reloaded automatically, use `npm run dev` if you need this.

    NOTE: ChaiNNer will use its own python installation, the same that a regular installation of chaiNNer also uses.

Generally, use `npm run dev` when you want to develop the backend or the frontend, and use `npm start` you want to start chaiNNer in a more production-like mode.

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

For more information about metadata, see the [Node Metadata section](#node-metadata).

And that's it. We have successfully implemented a new node. Now we can start chaiNNer and see our new node in action.

For more information about nodes, see the below section.

# Nodes

## Core concepts and idea

ChaiNNer is a visual programming language and development environment. Chains (`.chn` files) are programs and chaiNNer's UI is the editor for this programming language. The backend is the compiler and executor. Nodes are the functions of this language, they take inputs and produce outputs. Nodes are implemented as Python functions with extra metadata. This metadata is used to display the node in the UI and determine their behavior. E.g. type information is used to determine which connections are valid. Nodes are structured into categories and packages. ChaiNNer uses packages to manage the dependencies of nodes (e.g. pip packages), and categories to organize nodes in the UI.

### Rules for nodes

While nodes can generally implement whatever functionality you want, there are some rules that nodes must follow:

-   **Immutability** \
    Nodes are not allowed to modify their inputs. This is because chaiNNer will cache and reuse values for performance reasons. If a node modifies its input, this will break the cache and cause chaiNNer to produce incorrect results.

    This is especially important for images, which are passed around as numpy arrays. Numpy arrays are mutable, so you need to be careful when working with them. If you need to modify an input, make a copy of it first.

-   **Determinism** \
    Nodes are assumed to be deterministic. This means that a node should always produce the same output for the same input. This is important for caching.

    If your node needs random numbers, either use a static seed or use a seed input. See the Random Number node for an example of this.

    We do plan to add support for non-deterministic nodes in the future, but this is not implemented yet. See [#1677](https://github.com/chaiNNer-org/chaiNNer/issues/1677).

-   **Side effects** \
    Nodes are assumed to be side effect free. This means that a node should not change the file system (e.g. creating, changing, or deleting files), write to clipboard, open programs/files, or otherwise change the state of the system.

    If your node does have side effects (e.g. saving a file), you must declare this in the node metadata by using `side_effects=True`.

### Node metadata

Nodes have rich metadata. This includes a name, description, icon, and more. This metadata is used to display the node in the UI and determine their behavior. E.g. type information is used to determine which connections are valid.

Metadata is used to define a contract between a node, the rest of the backend, and the frontend. This contract is used to verify the correctness of the node implementation, optimize the node graph, and define frontend behavior.

-   **Schema ID** \
    The schema ID of the node. This is used to identify the node in the JSON API. This must be unique across all packages. We recommend using the format `chainner:<category>:<name>` for chaiNNer nodes.

    Note that the chaiNNer team has moved around nodes in the past. As such, you may find nodes that do not follow the above format. We recommend using the format above for new nodes.

-   **Name** \
    The name of the node. This is used to display the node in the UI.

    When choosing a name, make sure that it is descriptive and unique. If you are implementing a node that already exists in another package, make sure to use the same name. E.g. PyTorch and NCNN both have a Load Model node.

-   **Description** \
    A description of the node. This is currently only used in the node's tooltip in the node selector sidebar.
-   **Icon** \
    The icon of the node. Use the search bar on [React Icons](https://react-icons.github.io/react-icons) for which icons you want to use. Note that we only support icons from the `Bs`, `Cg`, `Md`, and `Im` families.
-   **Inputs/Outputs** \
    The inputs and outputs of the node. They describe the name, behavior, and type of the inputs and outputs. See [Input and Output](#inputs-and-outputs) for more information.
-   **Side effects** \
    Whether the node has side effects. See [Rules for nodes](#rules-for-nodes) for more information.

#### Inputs and Outputs

Nodes must explicitly declare all their inputs and outputs as part of their metadata. This is done using the `inputs` and `outputs` properties. Each argument of the python function has a corresponding input, and the return value of the function has a corresponding output. See [The anatomy of a node](#the-anatomy-of-a-node) for an example.

The main purpose of the explicitly declaring inputs and outputs is to provide more information about the node. E.g. the type information is used to determine which connections are valid, the minimum/maximum information is used to validate user inputs, and placeholder and defaults are used to improve the user experience.

The most common classes used to declare inputs are `NumberInput`, `TextInput`, and `ImageInput`. There is also `SliderInput` as an alternative to `NumberInput`. Many more inputs are available.

The most common classes used to declare outputs are `ImageOutput`, `NumberOutput`, and `TextOutput`. Many more outputs are available.

It is important to note that inputs and outputs have IDs. These IDs are used to identify the input/output in the JSON API. By default, IDs are implicitly assigned based on order. E.g. in the following example, A has the input ID 0, B has the input ID 1, and C has the output ID 0.

```python
inputs=[
    ImageInput("A"),
    NumberInput("B"),
],
outputs=[
    ImageOutput("C"),
],
```

##### Reordering

Since IDs are used to identify inputs and outputs, reordering them is a breaking change. If you want to reorder inputs or outputs, assign them explicit IDs using the `with_id` function, and then reorder them.

```python
# 1. Make IDs explicit
inputs=[
    ImageInput("A").with_id(0),
    NumberInput("B").with_id(1),
],
# 2. Reorder inputs
inputs=[
    NumberInput("B").with_id(1),
    ImageInput("A").with_id(0),
],
```

Adding a new input in between existing inputs is also a breaking change, because it counts as appending the new input and then moving it in between the existing inputs. To add a new input in between existing inputs, assign explicit IDs to all inputs and then move the new input into the correct position.

```python
# 1. Add input
inputs=[
    ImageInput("A"),
    NumberInput("B"),
    TextInput("T"),
],
# 2. Make IDs explicit
inputs=[
    ImageInput("A").with_id(0),
    NumberInput("B").with_id(1),
    TextInput("T").with_id(2),
],
# 3. Move input
inputs=[
    ImageInput("A").with_id(0),
    TextInput("T").with_id(2),
    NumberInput("B").with_id(1),
],
```

The same principles also apply to outputs.

#### Input groups

Input groups are a way of grouping inputs together and giving them additional functionality. Groups can change the visual appearance of the inputs, add additional functionality, and more.

The following groups are currently supported:

-   **Conditional** \
    Conditional groups are used to hide/show inputs based on the value of another input. This is useful for inputs that are only relevant in certain situations. E.g. the Save Image node uses conditional groups to hide JPEG-specific options when PNG is selected as the output format.

    We most commonly use `EnumInput`s or `DropDownInput`s as the input that controls the visibility of the group. This is because they are the easiest to work with.

    Example:

    ```python
    from enum import Enum
    from nodes.groups import if_enum_group
    from nodes.properties.inputs import EnumInput, NumberInput

    class Format(Enum):
        A = 1
        B = 2
        C = 3

    # inside @node_group.register(...)
    inputs = [
        EnumInput(Format, "Format", default=Format.A).with_id(0),
        if_enum_group(0, Format.B)(
            # this weight will only be shown if B is selected
            NumberInput("B weight", default=50, minimum=0, maximum=100),
        ),
    ]
    ```

-   **Seed** \
    This group is a wrapper around the `SeedInput` to change its visual appearance for better useability.

    ```python
    from nodes.group import group
    from nodes.properties.inputs import SeedInput

    # inside @node_group.register(...)
    inputs = [
        seed_group(SeedInput()),
    ]
    ```

-   And more. See `backend/src/nodes/groups.py` for more groups.

#### Types

All inputs and outputs have types. These types are automatically generated from the input/output class and the supplied arguments. E.g. `NumberInput("foo", minimum=0, maximum=100)` will have the type `int(0..100)` (read: an integer between 0 and 100 inclusive).

Types are expressed using a custom type system called Navi. Navi is not relative to Python's type hints or TypeScript types, it's a completely separate system. Since the Navi types of inputs and outputs are automatically generated, you rarely have to interact with Navi directly.

### Packages

A package is a collection of nodes. ChaiNNer comes with a set of standard nodes (`chaiNNer_standard`), but you can also create your own packages.

Unfortunately, packages are still a bit of a work in progress. We plan to improve the package system in the future. Right now, they are just fancy directories that contain nodes.

### Categories

Nodes are categorized. Categories are defined per package and follow a strict hierarchy. You can see this hierarchy in the node selector sidebar of chaiNNer.

At the top of the hierarchy are categories (e.g. Image Filter). Each category can have any number of subcategories, called node groups. Node groups then contain the actual nodes.

This gives us a clear path: package -> category -> node group -> node. E.g. the path of the Gaussian Blur node is `chaiNNer_standard -> Image Filter -> Blur -> Gaussian Blur`.

## The anatomy of a node

This section will explain how nodes are implemented in chaiNNer. We will use the `Opacity` node as an example. This node takes an image and an opacity value as input, and outputs the image with the opacity applied. It basically makes the image more transparent.

Here's the full code of the node:

```py
import numpy as np

from nodes.impl.pil_utils import convert_to_BGRA
from nodes.properties import expression
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:opacity",
    name="Opacity",
    description="Adjusts the opacity of an image. The higher the opacity value, the more opaque the image is.",
    icon="MdOutlineOpacity",
    inputs=[
        ImageInput(),
        SliderInput(
            "Opacity",
            maximum=100,
            default=100,
            precision=1,
            controls_step=1,
            unit="%",
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=expression.Image(size_as="Input0"),
            channels=4,
        )
    ],
)
def opacity_node(img: np.ndarray, opacity: float) -> np.ndarray:
    """Apply opacity adjustment to alpha channel"""

    # Convert inputs
    c = get_h_w_c(img)[2]
    if opacity == 100 and c == 4:
        return img
    imgout = convert_to_BGRA(img, c)
    opacity /= 100

    imgout[:, :, 3] *= opacity

    return imgout
```

We can see the code is roughly split into 2 parts: `@adjustments_group.register(...)` and `def opacity_node`.

The first part defines [the node's metadata](#node-metadata). Nodes are registered for a specific node group (see [the section on categories](#categories)). In this case, the node is registered for the `adjustments_group` node group. Name, description, and icon should be self-explanatory. The `schema_id` is a unique identifier for the node. Input and outputs define rich metadata about the arguments and return value of the node. E.g. The `SliderInput` contains a lot more information than `opacity: float`. See [the section on inputs and outputs](#inputs-and-outputs) for more information.

The second part is the actual node implementation. The implementation is rather straightforward. The node takes an image and an opacity value as input. Aside from handling a special case, it just multiplies the alpha channel of the image with the opacity value. Importantly, the input image is _not_ modified. Instead, the image is copied (`convert_to_BGRA` guarantees a copy) and the copy is modified and returned. See [the nodes section](#nodes) as to why copying is necessary.

It should be noted that metadata is used to verify the correctness of the implementation. E.g. the type hints of `img` and `opacity` are checked against the input metadata. So you can rely upon the fact that `opacity` is a number between 0 and 100. It's similar for the return type annotation. E.g. in this example, `ImageOutput` will validate that the returned image has 4 channels (as declared by `channels=4`) and will throw an error otherwise.
