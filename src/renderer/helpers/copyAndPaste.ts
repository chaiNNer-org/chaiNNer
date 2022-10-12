import { clipboard } from 'electron';
import log from 'electron-log';
import { Edge, Node } from 'reactflow';
import { EdgeData, NodeData } from '../../common/common-types';
import { createUniqueId, deriveUniqueId } from '../../common/util';
import { copyEdges, copyNodes, expandSelection, setSelected } from './reactFlowUtil';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface ClipboardChain {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
}

const getCopySelection = (nodes: readonly Node<NodeData>[]): Set<string> => {
    return expandSelection(
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
    const availableFormats = clipboard.availableFormats();
    if (availableFormats.length === 0) {
        try {
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
        } catch (e) {
            log.error('Invalid clipboard data', e);
        }
    } else {
        availableFormats.forEach((format) => {
            log.debug('Clipboard format', format);
            switch (format) {
                case 'text/plain':
                    log.debug('Clipboard text', clipboard.readText());
                    break;
                case 'text/html':
                    log.debug('Clipboard html', clipboard.readHTML());
                    break;
                case 'text/rtf':
                    log.debug('Clipboard rtf', clipboard.readRTF());
                    break;
                case 'image/png':
                    log.debug('Clipboard image', clipboard.readImage().toPNG());
                    break;
                default:
                    log.debug('Clipboard data', clipboard.readBuffer(format));
            }
        });
    }
};
