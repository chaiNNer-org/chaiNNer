from .. import NodeBase, NodeFactory

import cv2
import numpy as np


@NodeFactory.register('opencv', 'imwrite')
class ImWriteNode(NodeBase):
    def run(self, img: np.ndarray, path: str) -> bool:
        """ Write an image to the specified path and return write status """

        status = cv2.imwrite(path, img)

        return status

    # end run()


# end class ImWriteNode