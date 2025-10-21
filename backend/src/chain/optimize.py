from logger import get_logger_from_env

logger = get_logger_from_env()

from api import InputId, OutputId

from .chain import Chain, Edge, Node


class _Mutation:
    def __init__(self) -> None:
        self.changed = False

    def signal(self) -> None:
        self.changed = True


def __passthrough(
    chain: Chain,
    node: Node,
    input_id: InputId,
    output_id: OutputId = OutputId(0),  # noqa: B008
):
    """
    Rewires the chain such that the value of the given input is passed through to the given output.

    This assumes that the node itself has no effect on the value.

    Returns False if the input does not have a value or is not connected. True otherwise.
    """
    in_edge = chain.edge_to(node.id, input_id)
    if in_edge is not None:
        # rewire
        for e in chain.edges_from(node.id, output_id):
            chain.remove_edge(e)
            chain.add_edge(Edge(in_edge.source, e.target))
        return True
    else:
        value = chain.inputs.get(node.id, input_id)
        if value is not None:
            # constant propagation
            for e in chain.edges_from(node.id, output_id):
                chain.remove_edge(e)
                chain.inputs.set(e.target.id, e.target.input_id, value)
            return True

    return False


def __removed_dead_nodes(chain: Chain, mutation: _Mutation):
    """
    If a node does not have side effects and has no downstream nodes, then it can be removed.
    """

    for node in list(chain.nodes.values()):
        is_dead = len(chain.edges_from(node.id)) == 0 and not node.has_side_effects()
        if is_dead:
            chain.remove_node(node.id)
            mutation.signal()
            logger.debug(
                "Chain optimization: Removed %s node %s", node.schema_id, node.id
            )


def __removed_pass_through(chain: Chain, mutation: _Mutation):
    """
    Remove Passthrough nodes where possible.
    """

    # We only remove Passthrough nodes with a single input-output pair
    # For more information, see:
    #   https://github.com/chaiNNer-org/chaiNNer/issues/2555
    #   https://github.com/chaiNNer-org/chaiNNer/issues/2556
    for node in chain.nodes_with_schema_id("chainner:utility:pass_through"):
        out_edges = chain.edges_from(node.id)
        if len(out_edges) == 1 and len(chain.edges_to(node.id)) == 1:
            edge = out_edges[0]
            __passthrough(
                chain,
                node,
                input_id=InputId(edge.source.output_id),
                output_id=edge.source.output_id,
            )
            chain.remove_node(node.id)
            mutation.signal()


def __static_switch(chain: Chain, mutation: _Mutation):
    """
    If the selected variant of the Switch node is statically known (which should always be the case), then we can statically resolve and remove the Switch node.
    """

    for node in chain.nodes_with_schema_id("chainner:utility:switch"):
        value_index = chain.inputs.get(node.id, node.data.inputs[0].id)
        if isinstance(value_index, int):
            passed = False
            for index, i in enumerate(node.data.inputs[1:]):
                if index == value_index:
                    passed = __passthrough(chain, node, i.id)

            if passed:
                chain.remove_node(node.id)
                mutation.signal()


def __useless_conditional(chain: Chain, mutation: _Mutation):
    """
    Removes useless conditional nodes.
    """

    if_true = InputId(1)
    if_false = InputId(2)

    def as_bool(value: object):
        if isinstance(value, bool):
            return value
        if isinstance(value, int):
            if value == 0:
                return False
            if value == 1:
                return True
        return None

    for node in chain.nodes_with_schema_id("chainner:utility:conditional"):
        # the condition is a constant
        const_condition = as_bool(chain.inputs.get(node.id, InputId(0)))
        if const_condition is not None:
            __passthrough(
                chain,
                node,
                input_id=if_true if const_condition else if_false,
            )
            chain.remove_node(node.id)
            mutation.signal()
            continue

        # identical true and false branches
        true_edge = chain.edge_to(node.id, if_true)
        false_edge = chain.edge_to(node.id, if_false)
        if (
            true_edge is not None
            and false_edge is not None
            and true_edge.source == false_edge.source
        ):
            __passthrough(chain, node, if_true)
            chain.remove_node(node.id)
            mutation.signal()


def optimize(chain: Chain):
    max_passes = 10
    for _ in range(max_passes):
        mutation = _Mutation()

        __removed_dead_nodes(chain, mutation)
        __static_switch(chain, mutation)
        __removed_pass_through(chain, mutation)
        __useless_conditional(chain, mutation)

        if not mutation.changed:
            break
