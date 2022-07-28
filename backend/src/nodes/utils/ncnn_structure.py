from typing import Dict, List, Union


class NcnnLayer:
    def __init__(
        self,
        layer_type: str = "",
        layer_name: str = "",
        num_inputs: int = 0,
        num_outputs: int = 0,
        inputs: List[str] = [],
        outputs: List[str] = [],
        params: Dict[int, Union[float, int]] = {},
        weight_data: bytes = b"",
    ):
        self.layer_type: str = layer_type
        self.layer_name: str = layer_name
        self.num_inputs: int = num_inputs
        self.num_outputs: int = num_outputs
        self.inputs: List[str] = inputs
        self.outputs: List[str] = outputs
        self.params: Dict[int, Union[float, int]] = params
        self.weight_data: bytes = weight_data


class NcnnModel:
    MAGIC = "7767517"

    def __init__(self):
        self.node_count: int = 0
        self.blob_count: int = 0
        self.layer_list: List[NcnnLayer] = []
