from sanic.log import logger

from .chain import Chain


class _Mutation:
    def __init__(self) -> None:
        self.changed = False

    def signal(self) -> None:
        self.changed = True


def __removed_dead_nodes(chain: Chain, mutation: _Mutation):
    """
    If a node does not have side effects and has no downstream nodes, then it can be removed.
    """

    for node in list(chain.nodes.values()):
        is_dead = len(chain.edges_from(node.id)) == 0 and not node.has_side_effects()
        if is_dead:
            chain.remove_node(node.id)
            mutation.signal()
            logger.debug(f"Chain optimization: Removed {node.schema_id} node {node.id}")


def __static_switch_trim(chain: Chain, mutation: _Mutation):
    """
    If the selected variant of the Switch node is statically known, then we can remove the input edges of all other variants.
    """

    for node in list(chain.nodes.values()):
        if node.schema_id == "chainner:utility:switch":
            value_index = chain.inputs.get(node.id, node.data.inputs[0].id)
            if isinstance(value_index, int):
                for index, i in enumerate(node.data.inputs[1:]):
                    if index != value_index:
                        edge = chain.edge_to(node.id, i.id)
                        if edge is not None:
                            chain.remove_edge(edge)
                            mutation.signal()
                            logger.debug(
                                f"Chain optimization: Removed edge from {node.id} to {i.label}"
                            )


def optimize(chain: Chain):
    max_passes = 10
    for _ in range(max_passes):
        mutation = _Mutation()

        __removed_dead_nodes(chain, mutation)
        __static_switch_trim(chain, mutation)

        if not mutation.changed:
            break
