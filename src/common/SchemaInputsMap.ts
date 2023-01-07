import { Group, InputId, NodeSchema, SchemaId } from './common-types';
import { GroupInputItem, InputItem, checkGroupInputs } from './group-inputs';
import { EMPTY_ARRAY } from './util';

const createInputList = (schema: NodeSchema): readonly InputItem[] => {
    const byId = new Map(schema.inputs.map((input) => [input.id, input]));

    const groups: GroupInputItem[] = [];

    const convertLayout = (items: readonly (Group | InputId)[]): InputItem[] => {
        return items.map((i) => {
            if (typeof i === 'object') {
                const group: GroupInputItem = {
                    kind: 'group',
                    group: i,
                    inputs: convertLayout(i.items),
                };
                groups.push(group);
                return group;
            }

            const input = byId.get(i);
            if (input === undefined) {
                throw new Error(`Invalid or duplicate input id`);
            }
            byId.delete(i);
            return input;
        });
    };

    const result = convertLayout(schema.groupLayout);

    for (const { group, inputs } of groups) {
        const name = `${group.kind} group (id: ${group.id}) in ${schema.name} (id: ${schema.schemaId})`;
        const validity = checkGroupInputs(inputs, group, schema);
        if (!validity.isValid) {
            throw new Error(`The ${name} is invalid. ${validity.reason}`);
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
