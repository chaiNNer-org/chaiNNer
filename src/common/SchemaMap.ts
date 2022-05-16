import log from 'electron-log';
import { InputData, InputValue, NodeSchema } from './common-types';

const BLANK_SCHEMA: NodeSchema = {
    inputs: [],
    outputs: [],
    icon: '',
    category: '',
    subcategory: '',
    name: '',
    description: '',
    nodeType: '',
    schemaId: '',
};

export class SchemaMap {
    readonly schemata: readonly NodeSchema[];

    private readonly lookup: ReadonlyMap<string, NodeSchema>;

    constructor(schemata: readonly NodeSchema[]) {
        // defensive copy
        this.schemata = [...schemata];
        this.lookup = new Map<string, NodeSchema>(schemata.map((n) => [n.schemaId, n] as const));
    }

    has(schemaId: string): boolean {
        return this.lookup.has(schemaId);
    }

    get(schemaId: string, defaultValue = BLANK_SCHEMA): NodeSchema {
        const schema: NodeSchema | undefined = this.lookup.get(schemaId);
        if (schema === undefined) {
            log.warn(`Unknown node schema ${schemaId}. Returning blank schema.`);
        }
        return schema ?? defaultValue;
    }

    getDefaultInput(schemaId: string): InputData {
        const defaultData: Record<number, InputValue> = {};
        const { inputs } = this.get(schemaId);
        inputs.forEach((input, i) => {
            if (input.def || input.def === 0) {
                defaultData[i] = input.def;
            } else if (input.default || input.default === 0) {
                defaultData[i] = input.default;
            } else if (input.options) {
                defaultData[i] = input.options[0].value;
            }
        });
        return defaultData;
    }
}
