import { readFile, writeFile } from 'fs/promises';
import { Edge, Node, Viewport } from 'react-flow-renderer';
import { createHash } from 'crypto';
import semver from 'semver';
import { EdgeData, NodeData } from '../common-types';
import { migrate } from './migrations';

export interface SaveData {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
    viewport: Viewport;
}

export interface ParsedSaveData extends SaveData {
    tamperedWith: boolean;
}

interface RawSaveFile {
    version: string;
    content: SaveData;
    timestamp?: string;
    checksum?: string;
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
            const { version, content, checksum } = rawData;
            if (checksum !== undefined) {
                // checksum is present
                tamperedWith = checksum !== hash(JSON.stringify(content));
            } else {
                // checksum was added after v0.6.1, so any saves >0.6.1 without a checksum have
                // been tampered with
                tamperedWith = semver.gt(version, '0.6.1');
            }

            data = migrate(version, content) as SaveData;
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

    static stringify(content: SaveData, version: string): string {
        const data: RawSaveFile = {
            version,
            content,
            timestamp: new Date().toISOString(),
            checksum: hash(JSON.stringify(content)),
        };
        return JSON.stringify(data);
    }

    static async write(path: string, saveData: SaveData, version: string): Promise<void> {
        await writeFile(path, SaveFile.stringify(saveData, version), 'utf-8');
    }
}
