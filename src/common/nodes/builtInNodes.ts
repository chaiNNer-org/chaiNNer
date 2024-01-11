// WARNING: There is no frontend api for easily adding these nodes, as you are supposed to add new nodes in the backend.
// Adding nodes this way is undocumented and unsupported. These nodes exist to provide static values that would
// be impossible to add as regular nodes due to limitations. These nodes will get removed and replaced with
// static values prior to being run. If you are editing this file and you don't know what you're doing,
// please refer to this document on how to properly add nodes: https://github.com/chaiNNer-org/chaiNNer/blob/main/docs/nodes.md

import { CategoryId, NodeGroupId, NodeSchema, OutputId, SchemaId } from '../common-types';

export const executionNumberNode: NodeSchema = {
    schemaId: 'chainner:builtin:execution_number' as SchemaId,
    name: 'Execution Number',
    category: 'utility' as CategoryId,
    nodeGroup: 'utility/value' as NodeGroupId,
    inputs: [],
    outputs: [
        {
            id: 0 as OutputId,
            type: 'number',
            label: 'Execution Number',
            neverReason: null,
            kind: 'generic',
            hasHandle: true,
            description: null,
        },
    ],
    groupLayout: [],
    description:
        'Get the current execution number of this session. Increments by 1 every time you press the play button.',
    seeAlso: [],
    icon: 'MdNumbers',
    nodeType: 'regularNode',
    hasSideEffects: true,
    deprecated: false,
    features: [],
};

// export const notesNode: NodeSchema = {
//     schemaId: 'chainner:builtin:note' as SchemaId,
//     name: 'Note',
//     category: 'utility' as CategoryId,
//     nodeGroup: 'utility/text' as NodeGroupId,
//     inputs: [],
//     outputs: [],
//     groupLayout: [],
//     description:
//         'Make a sticky note for whatever notes or comments you want to leave in the chain. Supports markdown syntax.',
//     seeAlso: [],
//     icon: 'MdOutlineStickyNote2',
//     nodeType: 'note',
//     hasSideEffects: false,
//     deprecated: false,
//     features: [],
// };

export const builtInNodes: NodeSchema[] = [executionNumberNode];
export const builtInNodeSchemaIds = builtInNodes.map((n) => n.schemaId);
