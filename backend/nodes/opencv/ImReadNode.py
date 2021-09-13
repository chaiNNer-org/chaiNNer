from .. import NodeBase, NodeFactory

import cv2
import numpy as np


@NodeFactory.register('opencv', 'imread')
class ImReadNode(NodeBase):
    def run(self, path: str) -> np.ndarray:
        """ Reads an image from the specified path and return it as a numpy array """

        img = cv2.imread(path, cv2.IMREAD_UNCHANGED)

        return img

    # end run()


# end class ImReadNode