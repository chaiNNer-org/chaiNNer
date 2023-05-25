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

#### Python type hints

We require that all node functions have type hints. This is simply for correctness and to make the code easier to understand. You must add type hints to all arguments and the return value of the function.

```python
def blur_node(img: np.ndarray, radius: float) -> np.ndarray:
    ...
```

If you forget type hints or get them wrong, you will get a warning or an error when you try to register the node. The input and output metadata is used to validate your type hints. E.g. if you forget the `| None` for optional inputs, you will get a warning.

Note: We support Python 3.8 and 3.9, so you need to add `from __future__ import annotations` to the top of your file to use the union operator (`|`) in type hints.

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

The second part is the actual node implementation. The implementation is rather straightforward. The node takes an image and an opacity value as input. Aside from handling a special case, it just multiplies the alpha channel of the image with the opacity value. Importantly, the input image is _not_ modified. Instead, the image is copied (`convert_to_BGRA` guarantees a copy) and the copy is modified and returned. See [the nodes section](#rules-for-nodes) as to why copying is necessary.

It should be noted that metadata is used to verify the correctness of the implementation. E.g. the type hints of `img` and `opacity` are checked against the input metadata. So you can rely upon the fact that `opacity` is a number between 0 and 100. It's similar for the return type annotation. E.g. in this example, `ImageOutput` will validate that the returned image has 4 channels (as declared by `channels=4`) and will throw an error otherwise.
