import os from 'os';
import path from 'path';
import { Edge, Node, Project } from 'reactflow';
import { v4 as uuid4 } from 'uuid';
import { EdgeData, InputId, NodeData, SchemaId } from '../../common/common-types';
import { log } from '../../common/log';
import { createUniqueId, deriveUniqueId } from '../../common/util';
import { ipcRenderer } from '../safeIpc';
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
    ipcRenderer
        .invoke('clipboard-writeBuffer', 'application/chainner.chain', copyData, 'clipboard')
        .catch(log.error);
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

export const pasteFromClipboard = async (
    setNodes: SetState<Node<NodeData>[]>,
    setEdges: SetState<Edge<EdgeData>[]>,
    createNode: (proto: NodeProto, parentId?: string) => void,
    screenToFlowPosition: Project,
    reactFlowWrapper: React.RefObject<Element>
) => {
    const availableFormats = await ipcRenderer.invoke('clipboard-availableFormats');
    if (availableFormats.length === 0) {
        try {
            const clipboardData = await ipcRenderer.invoke(
                'clipboard-readBuffer',
                'application/chainner.chain'
            );
            const chain = JSON.parse(clipboardData.toString()) as ClipboardChain;

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
                    log.debug('Clipboard text', ipcRenderer.invoke('clipboard-readText'));
                    break;
                case 'text/html':
                    log.debug('Clipboard html', ipcRenderer.invoke('clipboard-readHTML'));
                    break;
                case 'text/rtf':
                    log.debug('Clipboard rtf', ipcRenderer.invoke('clipboard-readRTF'));
                    break;
                case 'image/jpeg':
                case 'image/gif':
                case 'image/bmp':
                case 'image/tiff':
                case 'image/png': {
                    ipcRenderer
                        .invoke('clipboard-readImage')
                        .then((clipboardData) => {
                            const imgData = clipboardData.toPNG();
                            const imgPath = path.join(
                                os.tmpdir(),
                                `chaiNNer-clipboard-${uuid4()}.png`
                            );
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
                                        position: screenToFlowPosition({
                                            x: positionX,
                                            y: positionY,
                                        }),
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
                        })
                        .catch((e) => {
                            log.error('Failed to read clipboard image', e);
                        });
                    break;
                }
                default:
                    log.debug('Clipboard data', ipcRenderer.invoke('clipboard-readBuffer', format));
            }
        });
    }
};
