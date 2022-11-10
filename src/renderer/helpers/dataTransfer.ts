import log from 'electron-log';
import { extname } from 'path';
import { Edge, Node, XYPosition } from 'reactflow';
import { EdgeData, Input, InputId, NodeData, SchemaId } from '../../common/common-types';
import { ipcRenderer } from '../../common/safeIpc';
import { openSaveFile } from '../../common/SaveFile';
import { SchemaMap } from '../../common/SchemaMap';
import { createUniqueId, deriveUniqueId } from '../../common/util';
import { PresetFile } from '../components/NodeSelectorPanel/presets';
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
    setNodes: SetState<Node<NodeData>[]>;
    setEdges: SetState<Edge<EdgeData>[]>;
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
    { setNodes, setEdges, getNodePosition }
) => {
    if (!dataTransfer.getData(TransferTypes.Preset)) return false;

    const { content: chain } = JSON.parse(dataTransfer.getData(TransferTypes.Preset)) as PresetFile;

    const duplicationId = createUniqueId();
    const deriveId = (oldId: string) => deriveUniqueId(duplicationId + oldId);

    setNodes((nodes) => {
        const currentIds = new Set(nodes.map((n) => n.id));
        const newIds = new Set(chain.nodes.map((n) => n.id));

        let newNodes = copyNodes(
            chain.nodes as Node<NodeData>[],
            deriveId,
            (oldId) => {
                if (newIds.has(oldId)) return deriveId(oldId);
                if (currentIds.has(oldId)) return oldId;
                return undefined;
            },
            false
        );

        newNodes = newNodes.map((node) => ({
            ...node,
            position: getNodePosition(-node.position.x, -node.position.y),
        }));

        return [...setSelected(nodes, false), ...setSelected(newNodes, true)];
    });
    setEdges((edges) => {
        const newEdges = copyEdges(chain.edges as Edge<EdgeData>[], deriveId);
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
                .catch((reason) => log.error(reason));

            return true;
        }
    }
    return false;
};

const openImageFileProcessor: DataTransferProcessor = (
    dataTransfer,
    { schemata, getNodePosition, createNode }
) => {
    const LOAD_IMAGE_ID = 'chainner:image:load' as SchemaId;
    if (!schemata.has(LOAD_IMAGE_ID)) return false;
    const schema = schemata.get(LOAD_IMAGE_ID);
    const input = schema.inputs[0] as Input | undefined;
    const fileTypes = input && input.kind === 'file' && input.filetypes;
    if (!fileTypes) return false;

    const path = getSingleFileWithExtension(dataTransfer, fileTypes);
    if (path) {
        // found a supported image file

        createNode({
            // hard-coded offset because it looks nicer
            position: getNodePosition(100, 100),
            data: {
                schemaId: LOAD_IMAGE_ID,
                inputData: { [0 as InputId]: path },
            },
            nodeType: schema.nodeType,
        });

        return true;
    }
    return false;
};

export const dataTransferProcessors: readonly DataTransferProcessor[] = [
    chainnerSchemaProcessor,
    chainnerPresetProcessor,
    openChainnerFileProcessor,
    openImageFileProcessor,
];
