import log from 'electron-log';
import { InputData, InputValue, NodeSchema } from '../common-types';

const BLANK_SCHEMA: NodeSchema = {
    inputs: [],
    outputs: [],
    icon: '',
    category: '',
    subcategory: '',
    name: '',
    description: '',
    nodeType: '',
};

const getSchemaId = (category: string, name: string): string => `${category}\n${name}`;

// eslint-disable-next-line import/prefer-default-export
export class SchemaMap {
    readonly schemata: readonly NodeSchema[];

    private readonly lookup: ReadonlyMap<string, NodeSchema>;

    constructor(schemata: readonly NodeSchema[]) {
        // defensive copy
        this.schemata = [...schemata];
        this.lookup = new Map<string, NodeSchema>(
            schemata.map((n) => [getSchemaId(n.category, n.name), n] as const)
        );
    }

    has(category: string, name: string): boolean {
        return this.lookup.has(getSchemaId(category, name));
    }

    get(category: string, name: string, defaultValue = BLANK_SCHEMA): NodeSchema {
        const schema: NodeSchema | undefined = this.lookup.get(getSchemaId(category, name));
        if (schema === undefined) {
            log.warn(`Unknown node schema ${category} > ${name}. Returning blank schema.`);
        }
        return schema ?? defaultValue;
    }

    getDefaultInput(category: string, name: string): InputData {
        const defaultData: Record<number, InputValue> = {};
        const { inputs } = this.get(category, name);
        if (inputs) {
            inputs.forEach((input, i) => {
                if (input.def || input.def === 0) {
                    defaultData[i] = input.def;
                } else if (input.default || input.default === 0) {
                    defaultData[i] = input.default;
                } else if (input.options) {
                    defaultData[i] = input.options[0].value;
                }
            });
        }
        return defaultData;
    }
}
