from sanic.log import logger

from .chain import Chain, EdgeSource, IteratorNode, NodeData


def __has_side_effects(node: NodeData) -> bool:
    if isinstance(node, IteratorNode) or node.is_helper:
        # we assume that both iterators and their helper nodes always have side effects
        return True
    return node.has_side_effects()


def __outline_child_nodes(chain: Chain) -> bool:
    """
    If a child node of an iterator is not downstream of any iterator helper node,
    then this child node can be lifted out of the iterator (outlined) to be a free node.
    """
    changed = False

    for node in chain.nodes.values():
        # we try to outline child nodes that are not iterator helper nodes
        if node.parent is not None and not node.is_helper:

            def has_no_parent(source: EdgeSource) -> bool:
                n = chain.nodes.get(source.id)
                assert n is not None
                return n.parent is None

            # we can only outline if all of its inputs are independent of the iterator
            can_outline = all(has_no_parent(n.source) for n in chain.edges_to(node.id))
            if can_outline:
                node.parent = None
                changed = True
                logger.debug(
                    f"Chain optimization: Outlined {node.schema_id} node {node.id}"
                )

    return changed


def __removed_dead_nodes(chain: Chain) -> bool:
    """
    If a node does not have side effects and has no downstream nodes, then it can be removed.
    """
    changed = False

    for node in list(chain.nodes.values()):
        is_dead = len(chain.edges_from(node.id)) == 0 and not __has_side_effects(node)
        if is_dead:
            chain.remove_node(node.id)
            changed = True
            logger.debug(f"Chain optimization: Removed {node.schema_id} node {node.id}")

    return changed


def optimize(chain: Chain):
    changed = True
    while changed:
        changed = __removed_dead_nodes(chain) or __outline_child_nodes(chain)
