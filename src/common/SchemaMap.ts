import {
    CategoryId,
    InputData,
    InputId,
    InputValue,
    NodeGroupId,
    NodeSchema,
    SchemaId,
} from './common-types';
import { log } from './log';
import { getDefaultValue } from './util';

const BLANK_SCHEMA: NodeSchema = {
    inputs: [],
    outputs: [],
    groupLayout: [],
    iteratorInputs: [],
    iteratorOutputs: [],
    icon: '',
    category: '' as CategoryId,
    nodeGroup: '' as NodeGroupId,
    name: '',
    description: '',
    seeAlso: [],
    kind: 'regularNode',
    schemaId: '' as SchemaId,
    hasSideEffects: false,
    deprecated: false,
    features: [],
    suggestions: [],
};

export class SchemaMap {
    readonly schemata: readonly NodeSchema[];

    private readonly lookup: ReadonlyMap<SchemaId, NodeSchema>;

    private readonly unique: ReadonlySet<SchemaId>;

    static readonly EMPTY: SchemaMap = new SchemaMap([]);

    constructor(schemata: readonly NodeSchema[]) {
        // defensive copy
        this.schemata = [...schemata];
        this.lookup = new Map<SchemaId, NodeSchema>(schemata.map((n) => [n.schemaId, n] as const));

        const byName = new Map<string, SchemaId[]>();
        for (const { name, schemaId } of this.schemata) {
            let list = byName.get(name);
            if (list === undefined) {
                list = [];
                byName.set(name, list);
            }
            list.push(schemaId);
        }
        this.unique = new Set([...byName.values()].filter((l) => l.length === 1).map((l) => l[0]));
    }

    /**
     * Returns whether the given schema has a unique name among all schemata.
     */
    hasUniqueName(schemaId: SchemaId): boolean {
        return this.unique.has(schemaId);
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
            defaultData[input.id] = getDefaultValue(input);
        });
        return defaultData;
    }
}
