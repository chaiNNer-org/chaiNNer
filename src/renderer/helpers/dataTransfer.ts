import { extname } from 'path';
import { Edge, Node, XYPosition } from 'reactflow';
import { EdgeData, NodeData, SchemaId } from '../../common/common-types';
import { log } from '../../common/log';
import { SchemaMap } from '../../common/SchemaMap';
import { createUniqueId, deriveUniqueId } from '../../common/util';
import { ipcRenderer } from '../safeIpc';
import { NodeProto, copyEdges, copyNodes, setSelected } from './reactFlowUtil';
import { SetState } from './types';
import type { ParsedSaveData } from '../../main/SaveFile';

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

/**
 * Returns the absolute path of a dropped/selected file.
 *
 * Electron 32 removed the non-standard `File.path` property, so this goes through
 * `webUtils.getPathForFile`, which the preload script bridges into the renderer.
 */
export const getFilePath = (file: File): string => window.electronFileUtils.getPathForFile(file);

export const getSingleFileWithExtension = (
    dataTransfer: DataTransfer,
    allowedExtensions: readonly string[]
): string | undefined => {
    if (dataTransfer.files.length === 1) {
        const [file] = dataTransfer.files;
        const path = getFilePath(file);
        const extension = extname(path).toLowerCase();
        if (allowedExtensions.includes(extension)) {
            return path;
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
    { getNodePosition, createNode }
) => {
    if (!dataTransfer.getData(TransferTypes.ChainnerSchema)) return false;

    const { schemaId, offsetX, offsetY } = JSON.parse(
        dataTransfer.getData(TransferTypes.ChainnerSchema)
    ) as ChainnerDragData;

    createNode({
        position: getNodePosition(offsetX, offsetY),
        data: { schemaId },
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
            (oldId) => {
                if (newIds.has(oldId)) return deriveId(oldId);
                if (currentIds.has(oldId)) return oldId;
                return oldId;
            },
            false
        );

        newNodes = newNodes.map((node) => ({
            ...node,
            position: getNodePosition(-node.position.x, -node.position.y),
        }));

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
        const path = getFilePath(file);
        if (/\.chn/i.test(path)) {
            // found a .chn file

            // The main process opens the file and pushes the result back over `file-open`, the
            // same way it handles files opened via the OS or the menu. This used to invoke
            // `open-save-file` here and then re-broadcast the result to this very window with
            // `ipcRenderer.sendTo(1, ...)`, but renderer-to-renderer messaging was removed in
            // Electron 28.
            ipcRenderer.invoke('open-dropped-save-file', path).catch(log.error);

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
