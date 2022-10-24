import { Edge, Node } from 'reactflow';
import simpleExample from './simple_example.json';

export interface PresetFile {
    version: string;
    content: {
        nodes: Node<unknown>[];
        edges: Edge<unknown>[];
    }; // SaveData;
    timestamp?: string;
    checksum?: string;
    migration?: number;
}

export interface Preset {
    name: string;
    author: string;
    description: string;
    chain: PresetFile;
}

export const presets = [
    {
        name: 'Simple Example',
        author: 'chaiNNer',
        description: 'A simple example preset for development purposes',
        chain: simpleExample,
    },
];
