import { readFile } from 'fs/promises';
import { extname } from 'path';
import { EdgeData, InputData, InputId, InputValue, Mutable, NodeData } from './common-types';
import { InputOverrideId } from './input-override-common';
import { log } from './log';
import { SchemaMap } from './SchemaMap';
import { joinEnglish } from './util';
import type { Edge, Node } from 'reactflow';

const isValidInputOverrideId = (id: InputOverrideId) => /^#[a-f0-9-]{36}:\d+$/.test(id);
export const parseInputOverrideId = (id: InputOverrideId): { nodeId: string; inputId: InputId } => {
    if (!isValidInputOverrideId(id)) throw new Error(`"${id}" is not a valid input override id.`);

    const nodeId = id.substring(1, 37);
    const inputId = Number(id.slice(38)) as InputId;

    return { nodeId, inputId };
};

export interface OverrideFile {
    inputs?: Record<InputOverrideId, string | number | null>;
}

export const readOverrideFile = async (filePath: string): Promise<OverrideFile> => {
    const content = await readFile(filePath, { encoding: 'utf-8' });
    const data = JSON.parse(content) as unknown;
    if (typeof data !== 'object')
        throw new Error('Expected the override file to contain an object');
    return data as OverrideFile;
};

const assignInput = (
    node: Node<NodeData>,
    inputId: InputId,
    value: InputValue,
    schemata: SchemaMap
): void => {
    const schema = schemata.get(node.data.schemaId);
    const input = schema.inputs.find((i) => i.id === inputId);
    if (!input) throw new Error(`No input with id ${inputId} for node ${node.id}.`);

    const inputData = node.data.inputData as Mutable<InputData>;

    if (value === undefined) {
        if (!input.optional)
            throw new Error(
                `The input with id ${inputId} on node ${node.id} is not optional but was assigned null/undefined.`
            );

        inputData[inputId] = undefined;
        return;
    }

    const errorStart = `The input with id ${inputId} on node ${node.id} is a ${input.kind} input`;

    switch (input.kind) {
        case 'directory': {
            if (typeof value !== 'string')
                throw new Error(`${errorStart}, which expects a string value.`);

            inputData[inputId] = value;
            break;
        }
        case 'file': {
            if (typeof value !== 'string')
                throw new Error(`${errorStart}, which expects a string value.`);

            const ext = extname(value).toLowerCase();
            if (!input.filetypes.includes(ext)) {
                throw new Error(
                    `${errorStart}, which expects ${joinEnglish(
                        input.filetypes,
                        'or'
                    )} files but was given ${value}.`
                );
            }

            inputData[inputId] = value;
            break;
        }
        case 'number':
        case 'slider': {
            if (typeof value !== 'number')
                throw new Error(`${errorStart}, which expects a number value.`);

            const { min, max, precision } = input;
            if (precision === 0 && !Number.isInteger(value))
                throw new Error(`${errorStart}, which expects an integer found ${value}.`);
            if (min != null && value < min)
                throw new Error(
                    `${errorStart}, which expects a number >= ${min} but found ${value}.`
                );
            if (max != null && value > max)
                throw new Error(
                    `${errorStart}, which expects a number <= ${max} but found ${value}.`
                );

            inputData[inputId] = value;
            break;
        }
        case 'text': {
            const text = String(value);

            const { minLength, maxLength } = input;
            if (minLength != null && text.length < minLength)
                throw new Error(`${errorStart}, which expects at least ${minLength} characters.`);
            if (maxLength != null && text.length > maxLength)
                throw new Error(`${errorStart}, which expects at most ${maxLength} characters.`);

            inputData[inputId] = text;
            break;
        }
        default:
            throw new Error(`${errorStart}, which does not support overrides.`);
    }
};

export const applyOverrides = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap,
    overrideFile: OverrideFile
): void => {
    if (!overrideFile.inputs) {
        // nothing to do
        return;
    }

    const overrides = new Map<string, Map<InputId, string | number | null>>();
    for (const [id, value] of Object.entries(overrideFile.inputs)) {
        const { nodeId, inputId } = parseInputOverrideId(id);

        let perNode = overrides.get(nodeId);
        if (perNode === undefined) {
            perNode = new Map();
            overrides.set(nodeId, perNode);
        }

        perNode.set(inputId, value);
    }

    for (const node of nodes) {
        const perNode = overrides.get(node.id);
        if (perNode) {
            overrides.delete(node.id);
            for (const [inputId, value] of perNode) {
                assignInput(node, inputId, value ?? undefined, schemata);
            }
        }
    }

    const unused = [...overrides.values()].flatMap((o) => o.size).reduce((a, b) => a + b, 0);
    if (unused > 0) {
        log.warn(`${unused} unused override(s).`);
    }
};
