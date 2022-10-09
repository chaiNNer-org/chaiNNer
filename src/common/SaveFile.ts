import { createHash } from 'crypto';
import log from 'electron-log';
import { readFile, writeFile } from 'fs/promises';
import { Edge, Node, Viewport } from 'reactflow';
import { EdgeData, FileOpenResult, NodeData, Version } from './common-types';
import { currentMigration, migrate } from './migrations';
import { versionGt } from './version';

export interface SaveData {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
    viewport: Viewport;
}

export interface ParsedSaveData extends SaveData {
    tamperedWith: boolean;
}

export interface RawSaveFile {
    version: Version;
    content: SaveData;
    timestamp?: string;
    checksum?: string;
    migration?: number;
}

const hash = (value: string): string => {
    return createHash('md5').update(value).digest('hex');
};

export class SaveFile {
    static parse(value: string): ParsedSaveData {
        if (!/^\s*\{/.test(value)) {
            // base64 decode
            // eslint-disable-next-line no-param-reassign
            value = Buffer.from(value, 'base64').toString('utf-8');
        }

        const rawData = JSON.parse(value) as RawSaveFile | (SaveData & { version?: never });

        let data: SaveData;
        let tamperedWith = false;
        if (rawData.version) {
            const { version, content, checksum, migration } = rawData;
            if (checksum !== undefined) {
                // checksum is present
                tamperedWith = checksum !== hash(JSON.stringify(content));
            } else {
                // checksum was added after v0.6.1, so any saves >0.6.1 without a checksum have
                // been tampered with
                tamperedWith = versionGt(version, '0.6.1') || (migration ?? 0) > 4;
            }

            data = migrate(version, content, migration) as SaveData;
        } else {
            // Legacy files
            data = migrate(null, rawData) as SaveData;
        }

        return {
            ...data,
            tamperedWith,
        };
    }

    static async read(path: string): Promise<ParsedSaveData> {
        return SaveFile.parse(await readFile(path, { encoding: 'utf-8' }));
    }

    static stringify(content: SaveData, version: Version): string {
        const { nodes, edges, viewport } = content;
        const sanitizedNodes = nodes.map<Node<NodeData>>((n) => ({
            data: {
                schemaId: n.data.schemaId,
                inputData: n.data.inputData,
                inputSize: n.data.inputSize,
                id: n.data.id,
                iteratorSize: n.data.iteratorSize,
                isDisabled: n.data.isDisabled,
                isLocked: n.data.isLocked,
                parentNode: n.data.parentNode,
            },
            id: n.id,
            position: n.position,
            type: n.type,
            selected: n.selected,
            height: n.height,
            width: n.width,
            zIndex: n.zIndex,
            parentNode: n.parentNode,
        }));
        const sanitizedContent = { nodes: sanitizedNodes, edges, viewport };
        const data: Required<RawSaveFile> = {
            version,
            content: sanitizedContent,
            timestamp: new Date().toISOString(),
            checksum: hash(JSON.stringify(sanitizedContent)),
            migration: currentMigration,
        };
        return JSON.stringify(data);
    }

    static async write(path: string, saveData: SaveData, version: Version): Promise<void> {
        await writeFile(path, SaveFile.stringify(saveData, version), 'utf-8');
    }
}

export const openSaveFile = async (path: string): Promise<FileOpenResult<ParsedSaveData>> => {
    try {
        const saveData = await SaveFile.read(path);
        return { kind: 'Success', path, saveData };
    } catch (error) {
        log.error(error);
        return { kind: 'Error', path, error: String(error) };
    }
};
