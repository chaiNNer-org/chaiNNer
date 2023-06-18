import { extname } from 'path';
import { Edge, Node, XYPosition } from 'reactflow';
import { EdgeData, NodeData, SchemaId } from '../../common/common-types';
import { log } from '../../common/log';
import { ipcRenderer } from '../../common/safeIpc';
import { ParsedSaveData, openSaveFile } from '../../common/SaveFile';
import { SchemaMap } from '../../common/SchemaMap';
import { createUniqueId, deriveUniqueId } from '../../common/util';
import { NodeProto, copyEdges, copyNodes, setSelected } from './reactFlowUtil';
import { SetState } from './types';

export interface ChainnerDragData {
    schemaId: SchemaId;
    offsetX?: number;
    offsetY?: number;
}

export const enum TransferTypes {
    ChainnerSchema = 'application/chainner/schema',
    Preset = 'application/chainner/preset',
}

export interface DataTransferProcessorOptions {
    createNode: (proto: NodeProto) => void;
    getNodePosition: (offsetX?: number, offsetY?: number) => XYPosition;
    schemata: SchemaMap;
    changeNodes: SetState<Node<NodeData>[]>;
    changeEdges: SetState<Edge<EdgeData>[]>;
}

export const getSingleFileWithExtension = (
    dataTransfer: DataTransfer,
    allowedExtensions: readonly string[]
): string | undefined => {
    if (dataTransfer.files.length === 1) {
        const [file] = dataTransfer.files;
        const extension = extname(file.path).toLowerCase();
        if (allowedExtensions.includes(extension)) {
            return file.path;
        }
    }
    return undefined;
};

/**
 * Returns `false` if the data could not be processed by this processor.
 *
 * Returns `true` if the data has been successfully transferred.
 */
export type DataTransferProcessor = (
    dataTransfer: DataTransfer,
    options: DataTransferProcessorOptions
) => boolean;

const chainnerSchemaProcessor: DataTransferProcessor = (
    dataTransfer,
    { getNodePosition, createNode, schemata }
) => {
    if (!dataTransfer.getData(TransferTypes.ChainnerSchema)) return false;

    const { schemaId, offsetX, offsetY } = JSON.parse(
        dataTransfer.getData(TransferTypes.ChainnerSchema)
    ) as ChainnerDragData;

    const nodeSchema = schemata.get(schemaId);

    createNode({
        position: getNodePosition(offsetX, offsetY),
        data: { schemaId },
        nodeType: nodeSchema.nodeType,
    });
    return true;
};

const chainnerPresetProcessor: DataTransferProcessor = (
    dataTransfer,
    { changeNodes, changeEdges, getNodePosition }
) => {
    if (!dataTransfer.getData(TransferTypes.Preset)) return false;

    const chain = JSON.parse(dataTransfer.getData(TransferTypes.Preset)) as ParsedSaveData;

    const duplicationId = createUniqueId();
    const deriveId = (oldId: string) => deriveUniqueId(duplicationId + oldId);

    changeNodes((nodes) => {
        const currentIds = new Set(nodes.map((n) => n.id));
        const newIds = new Set(chain.nodes.map((n) => n.id));

        let newNodes = copyNodes(
            chain.nodes,
            deriveId,
            (oldId) => {
                if (newIds.has(oldId)) return deriveId(oldId);
                if (currentIds.has(oldId)) return oldId;
                return undefined;
            },
            false
        );

        newNodes = newNodes.map((node) =>
            node.parentNode
                ? node
                : {
                      ...node,
                      position: getNodePosition(-node.position.x, -node.position.y),
                  }
        );

        return [...setSelected(nodes, false), ...setSelected(newNodes, true)];
    });
    changeEdges((edges) => {
        const newEdges = copyEdges(chain.edges, deriveId);
        return [...setSelected(edges, false), ...setSelected(newEdges, true)];
    });
    return true;
};

const openChainnerFileProcessor: DataTransferProcessor = (dataTransfer) => {
    if (dataTransfer.files.length === 1) {
        const [file] = dataTransfer.files;
        if (/\.chn/i.test(file.path)) {
            // found a .chn file

            openSaveFile(file.path)
                .then((result) => {
                    // TODO: 1 is hard-coded. Find a better way
                    ipcRenderer.sendTo(1, 'file-open', result);
                })
                .catch(log.error);

            return true;
        }
    }
    return false;
};

const openFileProcessor: DataTransferProcessor = (
    dataTransfer,
    { schemata, getNodePosition, createNode }
) => {
    for (const schema of schemata.schemata) {
        for (const input of schema.inputs) {
            if (input.kind === 'file' && input.primaryInput) {
                const path = getSingleFileWithExtension(dataTransfer, input.filetypes);
                if (path) {
                    // found a supported file type

                    createNode({
                        // hard-coded offset because it looks nicer
                        position: getNodePosition(100, 100),
                        data: {
                            schemaId: schema.schemaId,
                            inputData: { [input.id]: path },
                        },
                        nodeType: schema.nodeType,
                    });

                    return true;
                }
            }
        }
    }
    return false;
};

export const dataTransferProcessors: readonly DataTransferProcessor[] = [
    chainnerSchemaProcessor,
    chainnerPresetProcessor,
    openChainnerFileProcessor,
    openFileProcessor,
];
