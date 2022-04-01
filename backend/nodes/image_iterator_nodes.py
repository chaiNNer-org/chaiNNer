import math
import os
import sys
from msilib.schema import Directory
from posixpath import splitext

import cv2
import numpy as np
from process import Executor
from sanic.log import logger

from .image_nodes import ImReadNode
from .node_base import IteratorNodeBase, NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *

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

        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

    def run(self, directory: str = "") -> any:
        imread = ImReadNode()
        return imread.run(directory)


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
    ) -> any:
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

        supported_filetypes = [
            ".png",
            ".jpg",
            ".jpeg",
        ]  # TODO: Make a method to get these dynamically based on the installed deps

        def walk_error_handler(exception_instance):
            logger.warn(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        for root, dirs, files in os.walk(
            directory, topdown=False, onerror=walk_error_handler
        ):
            if parent_executor.is_killed():
                return
            file_len = len(files)
            for idx, name in enumerate(files):
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
                filepath = os.path.join(root, name)
                base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    # Replace the input filepath with the filepath from the loop
                    nodes[img_path_node_id]["inputs"] = [filepath]
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
