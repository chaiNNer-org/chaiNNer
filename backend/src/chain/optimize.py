from sanic.log import logger

from .chain import Chain


def __removed_dead_nodes(chain: Chain) -> bool:
    """
    If a node does not have side effects and has no downstream nodes, then it can be removed.
    """
    changed = False

    for node in list(chain.nodes.values()):
        is_dead = len(chain.edges_from(node.id)) == 0 and not node.has_side_effects()
        if is_dead:
            chain.remove_node(node.id)
            changed = True
            logger.debug(f"Chain optimization: Removed {node.schema_id} node {node.id}")

    return changed


def optimize(chain: Chain):
    changed = True
    while changed:
        changed = __removed_dead_nodes(chain)
