/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { expect, test } from 'vitest';
import { EdgeData, InputId, NodeData, SchemaId } from '../../src/common/common-types';
import { getEffectivelyDisabledNodes } from '../../src/common/nodes/disabled';
import { SchemaMap } from '../../src/common/SchemaMap';
import type { Edge, Node } from 'reactflow';

// Helper to create a minimal node schema
const createSchema = (schemaId: string, inputs: Array<{ id: InputId; optional: boolean }>) =>
    ({
        schemaId: schemaId as SchemaId,
        name: `Test Node ${schemaId}`,
        description: '',
        icon: '',
        category: 'test' as any,
        nodeGroup: 'test' as any,
        inputs: inputs.map((i) => ({
            id: i.id,
            label: `Input ${i.id}`,
            optional: i.optional,
            hasHandle: true,
            hint: false,
            kind: 'generic' as const,
            type: { type: 'instance' as const, class: 'Any' as const },
            conversions: [],
            suggest: false,
        })),
        outputs: [],
        groupLayout: [],
        iteratorInputs: [],
        iteratorOutputs: [],
        kind: 'regularNode' as const,
        hasSideEffects: false,
        deprecated: false,
        features: [],
        seeAlso: [],
        suggestions: [],
    } as any);

// Helper to create a node
const createNode = (id: string, schemaId: string, isDisabled = false): Node<NodeData> => ({
    id,
    position: { x: 0, y: 0 },
    data: {
        id,
        schemaId: schemaId as SchemaId,
        isDisabled,
    } as NodeData,
    type: 'regularNode',
});

// Helper to create an edge
const createEdge = (
    id: string,
    sourceId: string,
    targetId: string,
    targetHandle: string
): Edge<EdgeData> => ({
    id,
    source: sourceId,
    target: targetId,
    targetHandle,
    sourceHandle: '0',
});

test('getEffectivelyDisabledNodes - basic disabled propagation', () => {
    const schemata = new SchemaMap([
        createSchema('node1', [{ id: 0 as InputId, optional: false }]),
        createSchema('node2', [{ id: 0 as InputId, optional: false }]),
    ]);

    const node1 = createNode('1', 'node1', true);
    const node2 = createNode('2', 'node2', false);

    const nodes = [node1, node2];
    const edges = [createEdge('e1', '1', '2', '2-0')];

    const disabled = getEffectivelyDisabledNodes(nodes, edges, schemata);

    expect(disabled).toHaveLength(2);
    expect(disabled.map((n) => n.id).sort()).toEqual(['1', '2']);
});

test('getEffectivelyDisabledNodes - optional input ignores disabled source', () => {
    const schemata = new SchemaMap([
        createSchema('node1', []),
        createSchema('node2', [{ id: 0 as InputId, optional: true }]),
    ]);

    const node1 = createNode('1', 'node1', true);
    const node2 = createNode('2', 'node2', false);

    const nodes = [node1, node2];
    const edges = [createEdge('e1', '1', '2', '2-0')];

    const disabled = getEffectivelyDisabledNodes(nodes, edges, schemata);

    // Node 2 should NOT be disabled even though node 1 is disabled,
    // because the connection is to an optional input
    expect(disabled).toHaveLength(1);
    expect(disabled[0].id).toBe('1');
});

test('getEffectivelyDisabledNodes - required input propagates disabled', () => {
    const schemata = new SchemaMap([
        createSchema('node1', []),
        createSchema('node2', [{ id: 0 as InputId, optional: false }]),
    ]);

    const node1 = createNode('1', 'node1', true);
    const node2 = createNode('2', 'node2', false);

    const nodes = [node1, node2];
    const edges = [createEdge('e1', '1', '2', '2-0')];

    const disabled = getEffectivelyDisabledNodes(nodes, edges, schemata);

    // Node 2 should be disabled because node 1 is disabled
    // and the connection is to a required input
    expect(disabled).toHaveLength(2);
    expect(disabled.map((n) => n.id).sort()).toEqual(['1', '2']);
});

test('getEffectivelyDisabledNodes - mixed inputs', () => {
    const schemata = new SchemaMap([
        createSchema('node1', []),
        createSchema('node2', []),
        createSchema('node3', [
            { id: 0 as InputId, optional: true },
            { id: 1 as InputId, optional: false },
        ]),
    ]);

    const node1 = createNode('1', 'node1', true); // disabled
    const node2 = createNode('2', 'node2', false); // enabled
    const node3 = createNode('3', 'node3', false); // should stay enabled

    const nodes = [node1, node2, node3];
    const edges = [
        createEdge('e1', '1', '3', '3-0'), // disabled node to optional input
        createEdge('e2', '2', '3', '3-1'), // enabled node to required input
    ];

    const disabled = getEffectivelyDisabledNodes(nodes, edges, schemata);

    // Node 3 should NOT be disabled because:
    // - Node 1 is disabled but connected to optional input 0
    // - Node 2 is enabled and connected to required input 1
    expect(disabled).toHaveLength(1);
    expect(disabled[0].id).toBe('1');
});

test('getEffectivelyDisabledNodes - switch node scenario', () => {
    const schemata = new SchemaMap([
        createSchema('load_image', []),
        createSchema('create_color', []),
        createSchema('switch', [
            { id: 0 as InputId, optional: true }, // Value A
            { id: 1 as InputId, optional: true }, // Value B
        ]),
        createSchema('view_image', [{ id: 0 as InputId, optional: false }]),
    ]);

    const loadImage = createNode('1', 'load_image', true); // disabled
    const createColor = createNode('2', 'create_color', false); // enabled
    const switchNode = createNode('3', 'switch', false);
    const viewImage = createNode('4', 'view_image', false);

    const nodes = [loadImage, createColor, switchNode, viewImage];
    const edges = [
        createEdge('e1', '1', '3', '3-0'), // disabled load_image to switch value A
        createEdge('e2', '2', '3', '3-1'), // enabled create_color to switch value B
        createEdge('e3', '3', '4', '4-0'), // switch to view_image
    ];

    const disabled = getEffectivelyDisabledNodes(nodes, edges, schemata);

    // Only the load_image node should be disabled
    // The switch and view_image should remain enabled even though
    // load_image is connected to the switch (because it's an optional input)
    expect(disabled).toHaveLength(1);
    expect(disabled[0].id).toBe('1');
});
