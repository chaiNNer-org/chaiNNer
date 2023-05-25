from random import Random

from nodes.groups import seed_group
from nodes.properties.inputs import NumberInput, SeedInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.seed import Seed

from .. import random_group


@random_group.register(
    schema_id="chainner:utility:random_number",
    name="Random Number",
    description="Generate a random integer.",
    icon="MdCalculate",
    inputs=[
        NumberInput(
            "Minimum Value",
            minimum=None,
            maximum=None,
        ),
        NumberInput(
            "Maximum Value",
            minimum=None,
            maximum=None,
            default=100,
        ),
        seed_group(SeedInput()),
    ],
    outputs=[
        NumberOutput("Result", output_type="int & max(.., Input0) & min(.., Input1)")
    ],
)
def random_number_node(min_val: int, max_val: int, seed: Seed) -> int:
    return Random(seed.value).randint(min_val, max_val)
