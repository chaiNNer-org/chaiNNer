import { XYPosition } from 'react-flow-renderer';
import log from 'electron-log';
import { extname } from 'path';
import { NodeProto } from './contexts/GlobalNodeState';
import { SchemaMap } from './SchemaMap';
import { FileOpenResult, ipcRenderer } from './safeIpc';
import { SaveFile } from './SaveFile';

export interface ChainnerDragData {
    schemaId: string;
    offsetX?: number;
    offsetY?: number;
}

export const enum TransferTypes {
    ChainerSchema = 'application/chainner/schema',
}

export interface DataTransferProcessorOptions {
    createNode: (proto: NodeProto) => void;
    getNodePosition: (offsetX?: number, offsetY?: number) => XYPosition;
    schemata: SchemaMap;
}

export const openSaveFile = async (path: string): Promise<FileOpenResult> => {
    try {
        const saveData = await SaveFile.read(path);
        return { kind: 'Success', path, saveData };
    } catch (error) {
        log.error(error);
        return { kind: 'Error', path, error: String(error) };
    }
};

/**
 * Returns `false` if the data couldn't not be processed by this processor.
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
    if (!dataTransfer.getData(TransferTypes.ChainerSchema)) return false;

    const { schemaId, offsetX, offsetY } = JSON.parse(
        dataTransfer.getData(TransferTypes.ChainerSchema)
    ) as ChainnerDragData;

    const nodeSchema = schemata.get(schemaId);

    createNode({
        position: getNodePosition(offsetX, offsetY),
        data: { schemaId },
        nodeType: nodeSchema.nodeType,
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
    const LOAD_IMAGE_ID = 'chainner:image:load';
    if (!schemata.has(LOAD_IMAGE_ID)) return false;
    const schema = schemata.get(LOAD_IMAGE_ID);
    const fileTypes = schema.inputs[0]?.filetypes;
    if (!fileTypes) return false;

    if (dataTransfer.files.length === 1) {
        const [file] = dataTransfer.files;
        const extension = extname(file.path).toLowerCase();
        if (fileTypes.includes(extension)) {
            // found a supported image file

            createNode({
                // hard-coded offset because it looks nicer
                position: getNodePosition(100, 100),
                data: {
                    schemaId: LOAD_IMAGE_ID,
                    inputData: { 0: file.path },
                },
                nodeType: schema.nodeType,
            });

            return true;
        }
    }
    return false;
};

export const dataTransferProcessors: readonly DataTransferProcessor[] = [
    chainnerSchemaProcessor,
    openChainnerFileProcessor,
    openImageFileProcessor,
];
