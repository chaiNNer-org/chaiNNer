import log from 'electron-log';
import { NodeSchema, SchemaMap } from '../common-types';

export const BLANK_SCHEMA: NodeSchema = {
    inputs: [],
    outputs: [],
    icon: '',
    subcategory: '',
    name: '',
    description: '',
    nodeType: '',
};

export const getSchema = (
    availableNodes: SchemaMap,
    category: string,
    type: string
): NodeSchema => {
    const schema: NodeSchema | undefined = availableNodes[category]?.[type];
    if (schema === undefined) {
        log.warn(`Unknown node schema ${category} > ${type}. Returning blank schema.`);
    }
    return schema ?? BLANK_SCHEMA;
};
