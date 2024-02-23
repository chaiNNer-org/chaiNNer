from random import Random

from nodes.groups import seed_group
from nodes.properties.inputs import NumberInput, SeedInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.seed import Seed

from .. import random_group


@random_group.register(
    schema_id="chainner:utility:random_number",
    name="随机数",
    description="生成一个随机整数。",
    icon="MdCalculate",
    inputs=[
        NumberInput(
            "最小值",
            minimum=None,
            maximum=None,
        ),
        NumberInput(
            "最大值",
            minimum=None,
            maximum=None,
            default=100,
        ),
        seed_group(SeedInput()),
    ],
    outputs=[
        NumberOutput("结果", output_type="int & max(.., Input0) & min(.., Input1)")
    ],
)
def random_number_node(min_val: int, max_val: int, seed: Seed) -> int:
    return Random(seed.value).randint(min_val, max_val)
