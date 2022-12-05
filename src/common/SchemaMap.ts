import log from 'electron-log';
import { InputData, InputId, InputValue, NodeSchema, SchemaId } from './common-types';

const BLANK_SCHEMA: NodeSchema = {
    inputs: [],
    outputs: [],
    groups: [],
    icon: '',
    category: '',
    subcategory: '',
    name: '',
    description: '',
    nodeType: 'regularNode',
    schemaId: '' as SchemaId,
    hasSideEffects: false,
    deprecated: false,
};

export class SchemaMap {
    readonly schemata: readonly NodeSchema[];

    private readonly lookup: ReadonlyMap<SchemaId, NodeSchema>;

    constructor(schemata: readonly NodeSchema[]) {
        // defensive copy
        this.schemata = [...schemata];
        this.lookup = new Map<SchemaId, NodeSchema>(schemata.map((n) => [n.schemaId, n] as const));
    }

    has(schemaId: SchemaId): boolean {
        return this.lookup.has(schemaId);
    }

    get(schemaId: SchemaId, defaultValue = BLANK_SCHEMA): NodeSchema {
        const schema: NodeSchema | undefined = this.lookup.get(schemaId);
        if (schema === undefined) {
            log.warn(`Unknown node schema ${schemaId}. Returning blank schema.`);
        }
        return schema ?? defaultValue;
    }

    getDefaultInput(schemaId: SchemaId): InputData {
        const defaultData: Record<InputId, InputValue> = {};
        const { inputs } = this.get(schemaId);
        inputs.forEach((input) => {
            if ('def' in input) {
                defaultData[input.id] = input.def ?? undefined;
            }
        });
        return defaultData;
    }
}
