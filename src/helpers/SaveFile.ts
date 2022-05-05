import { readFile, writeFile } from 'fs/promises';
import { Edge, Node, Viewport } from 'react-flow-renderer';
import { EdgeData, NodeData } from '../common-types';
import { migrate } from './migrations';

export interface SaveData {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
    viewport: Viewport;
}

interface ParsedSaveFile {
    version: string;
    timestamp: string;
    content: SaveData;
}

export class SaveFile {
    static parse(content: string): SaveData {
        if (!/^\s*\{/.test(content)) {
            // base64 decode
            // eslint-disable-next-line no-param-reassign
            content = Buffer.from(content, 'base64').toString('utf-8');
        }

        const data = JSON.parse(content) as ParsedSaveFile | { version: undefined };

        if (data.version) {
            return migrate(data.version, data.content) as SaveData;
        }
        // Legacy files
        return migrate(null, data) as SaveData;
    }

    static async read(path: string): Promise<SaveData> {
        return SaveFile.parse(await readFile(path, { encoding: 'utf-8' }));
    }

    static stringify(content: SaveData, version: string): string {
        const json = JSON.stringify({ version, content, timestamp: new Date() });
        return Buffer.from(json).toString('base64');
    }

    static async write(path: string, saveData: SaveData, version: string): Promise<void> {
        await writeFile(path, SaveFile.stringify(saveData, version), 'utf-8');
    }
}
