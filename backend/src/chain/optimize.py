from sanic.log import logger

from .chain import Chain, Node


def __has_side_effects(node: Node) -> bool:
    return node.has_side_effects()


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
        changed = __removed_dead_nodes(chain)
