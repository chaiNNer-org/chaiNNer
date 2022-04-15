import math
import os
import sys

import cv2
import numpy as np
from process import Executor
from sanic.log import logger

from .image_nodes import ImReadNode
from .node_base import IteratorNodeBase, NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import get_available_image_formats

IMAGE_ITERATOR_DEFAULT_NODE_NAME = "Load Image (Iterator)"


@NodeFactory.register("Image", IMAGE_ITERATOR_DEFAULT_NODE_NAME)
class ImageFileIteratorPathNode(NodeBase):
    """Image File Iterator node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput()]
        self.outputs = ImReadNode().get_outputs()
        self.outputs.insert(
            2, TextOutput("Relative Path")
        )  # Add relative path to outputs outside ImReadNode
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

    def run(self, directory: str = "", root_dir: str = "") -> any:
        imread = ImReadNode()
        imread_output = imread.run(directory)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(imread_output[1], root_dir)

        # Set ImRead directory output to root/base directory and insert relative path into outputs
        imread_output[1] = root_dir
        imread_output.insert(2, rel_path)

        return imread_output


@NodeFactory.register("Image", "Image File Iterator")
class ImageFileIteratorNode(IteratorNodeBase):
    """Image File Iterator node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Iterate over all files in a directory and run the provided nodes on just the image files."
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "category": "Image",
                "name": IMAGE_ITERATOR_DEFAULT_NODE_NAME,
            },
        ]

    async def run(
        self,
        directory: str,
        nodes: dict = {},
        external_cache: dict = {},
        loop=None,
        queue=None,
        id="",
        parent_executor=None,
        percent=0,
    ) -> Any:
        logger.info(f"Iterating over images in directory: {directory}")
        logger.info(nodes)

        img_path_node_id = None
        child_nodes = []
        for k, v in nodes.items():
            if (
                v["category"] == "Image"
                and v["node"] == IMAGE_ITERATOR_DEFAULT_NODE_NAME
            ):
                img_path_node_id = v["id"]
            if nodes[k]["child"]:
                child_nodes.append(v["id"])
            # Set this to false to actually allow processing to happen
            nodes[k]["child"] = False

        supported_filetypes = get_available_image_formats()

        def walk_error_handler(exception_instance):
            logger.warn(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        just_image_files = []
        for root, dirs, files in os.walk(
            directory, topdown=True, onerror=walk_error_handler
        ):
            if parent_executor.should_stop_running():
                return

            for name in files:
                filepath = os.path.join(root, name)
                base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_image_files.append(filepath)

        file_len = len(just_image_files)
        start_idx = math.ceil(float(percent) * file_len)
        for idx, filepath in enumerate(just_image_files):
            if parent_executor.should_stop_running():
                return
            if idx >= start_idx:
                await queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": idx / file_len,
                            "iteratorId": id,
                            "running": child_nodes,
                        },
                    }
                )
                # Replace the input filepath with the filepath from the loop
                nodes[img_path_node_id]["inputs"] = [filepath, directory]
                executor = Executor(
                    nodes,
                    loop,
                    queue,
                    external_cache.copy(),
                    parent_executor=parent_executor,
                )
                await executor.run()
                await queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": (idx + 1) / file_len,
                            "iteratorId": id,
                            "running": None,
                        },
                    }
                )
        return ""
