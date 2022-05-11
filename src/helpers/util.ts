import { constants } from 'fs';
import fs from 'fs/promises';
import { Node } from 'react-flow-renderer';
import { Mutable, NodeData } from '../common-types';

export const checkFileExists = (file: string): Promise<boolean> =>
    fs.access(file, constants.F_OK).then(
        () => true,
        () => false
    );

export const assertNever = (value: never): never => {
    throw new Error(`Unreachable code path. The value ${String(value)} is invalid.`);
};

export const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const noop = () => {};

export const copyNode = (node: Readonly<Node<NodeData>>): Node<Mutable<NodeData>> => deepCopy(node);

export interface ParsedHandle {
    id: string;
    index: number;
}
export const parseHandle = (handle: string): ParsedHandle => {
    return {
        id: handle.substring(0, 36), // uuid
        index: Number(handle.substring(37)),
    };
};

export const getLocalStorage = (): Storage => {
    const storage = (global as Record<string, unknown>).customLocalStorage;
    if (storage === undefined) throw new Error('Custom storage not defined');
    return storage as Storage;
};
