import { clipboard } from 'electron/common';
import os from 'os';
import path from 'path';
import { Edge, Node, Project } from 'reactflow';
import { v4 as uuid4 } from 'uuid';
import { EdgeData, InputId, NodeData, SchemaId } from '../../common/common-types';
import { log } from '../../common/log';
import { ipcRenderer } from '../../renderer/safeIpc';
import { createUniqueId, deriveUniqueId } from '../../common/util';
import { NodeProto, copyEdges, copyNodes, setSelected } from './reactFlowUtil';
import { SetState } from './types';

interface ClipboardChain {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
}

const getCopySelection = (nodes: readonly Node<NodeData>[]): Set<string> => {
    return new Set(nodes.filter((n) => n.selected).map((n) => n.id));
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
    setEdges: SetState<Edge<EdgeData>[]>,
    createNode: (proto: NodeProto, parentId?: string) => void,
    screenToFlowPosition: Project,
    reactFlowWrapper: React.RefObject<Element>
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

                const newNodes = copyNodes(chain.nodes, (oldId) => {
                    if (newIds.has(oldId)) return deriveId(oldId);
                    if (currentIds.has(oldId)) return oldId;
                    return oldId;
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
                case 'image/jpeg':
                case 'image/gif':
                case 'image/bmp':
                case 'image/tiff':
                case 'image/png': {
                    const imgData = clipboard.readImage().toPNG();
                    const imgPath = path.join(os.tmpdir(), `chaiNNer-clipboard-${uuid4()}.png`);
                    ipcRenderer
                        .invoke('fs-write-file', imgPath, imgData)
                        .then(() => {
                            log.debug('Clipboard image', imgPath);
                            let positionX = 0;
                            let positionY = 0;
                            if (reactFlowWrapper.current) {
                                const { height, width, x, y } =
                                    reactFlowWrapper.current.getBoundingClientRect();
                                positionX = (width + x) / 2;
                                positionY = (height + y) / 2;
                            }
                            createNode({
                                position: screenToFlowPosition({ x: positionX, y: positionY }),
                                data: {
                                    schemaId: 'chainner:image:load' as SchemaId,
                                    inputData: {
                                        [0 as InputId]: imgPath,
                                    },
                                },
                            });
                        })
                        .catch((e) => {
                            log.error('Failed to write clipboard image', e);
                        });
                    break;
                }
                default:
                    log.debug('Clipboard data', clipboard.readBuffer(format));
            }
        });
    }
};
