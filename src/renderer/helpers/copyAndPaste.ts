import { clipboard } from 'electron';
import { Edge, Node } from 'react-flow-renderer';
import { EdgeData, NodeData } from '../../common/common-types';
import { createUniqueId, deriveUniqueId } from '../../common/util';
import { copyEdges, copyNodes, expandCopySelection, setSelected } from './reactFlowUtil';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface ClipboardChain {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
}

const getCopySelection = (nodes: readonly Node<NodeData>[]): Set<string> => {
    return expandCopySelection(
        nodes,
        nodes.filter((n) => n.selected).map((n) => n.id)
    );
};

export const copyToClipboard = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[]
) => {
    const copyIds = getCopySelection(nodes);

    const data: ClipboardChain = {
        nodes: nodes.filter((n) => copyIds.has(n.id)),
        edges: edges.filter((e) => copyIds.has(e.source) && copyIds.has(e.target)),
    };
    const copyData = Buffer.from(JSON.stringify(data));
    clipboard.writeBuffer('application/chainner.chain', copyData, 'clipboard');
};

export const cutAndCopyToClipboard = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],

    setNodes: SetState<Node<NodeData>[]>,
    setEdges: SetState<Edge<EdgeData>[]>
) => {
    copyToClipboard(nodes, edges);

    const copyIds = getCopySelection(nodes);

    // eslint-disable-next-line @typescript-eslint/no-shadow
    setNodes((nodes) => nodes.filter((n) => !copyIds.has(n.id)));
    // eslint-disable-next-line @typescript-eslint/no-shadow
    setEdges((edges) =>
        edges.filter((e) => !(e.selected || copyIds.has(e.source) || copyIds.has(e.target)))
    );
};

export const pasteFromClipboard = (
    setNodes: SetState<Node<NodeData>[]>,
    setEdges: SetState<Edge<EdgeData>[]>
) => {
    const chain = JSON.parse(
        clipboard.readBuffer('application/chainner.chain').toString()
    ) as ClipboardChain;

    const duplicationId = createUniqueId();
    const deriveId = (oldId: string) => deriveUniqueId(duplicationId + oldId);

    setNodes((nodes) => {
        const currentIds = new Set(nodes.map((n) => n.id));
        const newIds = new Set(chain.nodes.map((n) => n.id));

        const newNodes = copyNodes(chain.nodes, deriveId, (oldId) => {
            if (newIds.has(oldId)) return deriveId(oldId);
            if (currentIds.has(oldId)) return oldId;
            return undefined;
        });

        return [...setSelected(nodes, false), ...setSelected(newNodes, true)];
    });
    setEdges((edges) => {
        const newEdges = copyEdges(chain.edges, deriveId);
        return [...setSelected(edges, false), ...setSelected(newEdges, true)];
    });
};
