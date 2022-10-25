import { Group, Input, NodeSchema, SchemaId } from './common-types';
import { groupInputsChecks } from './group-inputs';
import { EMPTY_ARRAY } from './util';

export interface SchemaInputItem {
    readonly kind: 'input';
    readonly input: Input;
}
export interface GroupInputItem {
    readonly kind: 'group';
    readonly group: Group;
    readonly inputs: readonly Input[];
}
export type InputItem = SchemaInputItem | GroupInputItem;

const createInputList = (schema: NodeSchema): readonly InputItem[] => {
    const result: InputItem[] = [];

    // This code makes the following assumptions:
    // 1. All groups only references valid input ids.
    // 2. No two groups reference the same input.
    // 3. Groups only reference contiguous inputs.
    // 4. All groups reference at least one input.

    for (let i = 0; i < schema.inputs.length; i += 1) {
        const input = schema.inputs[i];
        const group = schema.groups.find((g) => g.items.includes(input.id));
        if (group) {
            const inputs = schema.inputs.slice(i, i + group.items.length);

            const isValidCheck = groupInputsChecks[group.kind] as
                | undefined
                | ((inputs: readonly Input[], group: Group) => boolean);
            const name = `${group.kind} group (id: ${group.id}) in ${schema.name} (id: ${schema.schemaId})`;
            if (!isValidCheck) {
                throw new Error(
                    `The ${name} is invalid. "${group.kind}" is not a valid group kind.`
                );
            }
            if (!isValidCheck(inputs, group as never)) {
                throw new Error(
                    `The ${name} is invalid. This is likely a bug in either they python group definition.`
                );
            }

            result.push({ kind: 'group', group, inputs });
            i += group.items.length - 1;
        } else {
            result.push({ kind: 'input', input });
        }
    }

    return result;
};

export class SchemaInputsMap {
    private readonly map: ReadonlyMap<SchemaId, readonly InputItem[]>;

    constructor(schemata: readonly NodeSchema[]) {
        this.map = new Map(schemata.map((schema) => [schema.schemaId, createInputList(schema)]));
    }

    get(schemaId: SchemaId): readonly InputItem[] {
        return this.map.get(schemaId) ?? EMPTY_ARRAY;
    }
}
