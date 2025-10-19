import { Edge, Node } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { NodeSchema } from '../../src/common/common-types';
import { ChainLineage } from '../../src/common/nodes/lineage';
import { SchemaMap } from '../../src/common/SchemaMap';

describe('ChainLineage - Multiple Iterators', () => {
    it('should allow regular nodes to have multiple iterated inputs from different generators', () => {
        // Create mock schemas
        const loadImagesSchema: Partial<NodeSchema> = {
            schemaId: 'test:loadImages',
            name: 'Load Images',
            category: 'test',
            kind: 'generator',
            inputs: [],
            outputs: [
                { id: 0, label: 'Image', type: 'Image', kind: 'generic' },
                { id: 1, label: 'Directory', type: 'Directory', kind: 'generic' },
            ],
            groupLayout: [],
            iteratorOutputs: [{ outputs: [0], lengthType: 'uint' }],
            defaultNodes: [],
        };

        const loadModelsSchema: Partial<NodeSchema> = {
            schemaId: 'test:loadModels',
            name: 'Load Models',
            category: 'test',
            kind: 'generator',
            inputs: [],
            outputs: [
                { id: 0, label: 'Model', type: 'Model', kind: 'generic' },
                { id: 1, label: 'Directory', type: 'Directory', kind: 'generic' },
            ],
            groupLayout: [],
            iteratorOutputs: [{ outputs: [0], lengthType: 'uint' }],
            defaultNodes: [],
        };

        const upscaleSchema: Partial<NodeSchema> = {
            schemaId: 'test:upscale',
            name: 'Upscale Image',
            category: 'test',
            kind: 'regularNode',
            inputs: [
                { id: 0, label: 'Image', type: 'Image', kind: 'generic', hasHandle: true },
                { id: 1, label: 'Model', type: 'Model', kind: 'generic', hasHandle: true },
            ],
            outputs: [{ id: 0, label: 'Image', type: 'Image', kind: 'generic' }],
            groupLayout: [],
            defaultNodes: [],
        };

        // Create mock SchemaMap
        const schemata = new Map<string, NodeSchema>([
            ['test:loadImages', loadImagesSchema as NodeSchema],
            ['test:loadModels', loadModelsSchema as NodeSchema],
            ['test:upscale', upscaleSchema as NodeSchema],
        ]);
        const schemaMap = {
            get: (id: string) => schemata.get(id)!,
            schemata: Array.from(schemata.values()),
            categories: new Map(),
        } as unknown as SchemaMap;

        // Create nodes with UUIDs
        const loadImagesId = '00000000-0000-0000-0000-000000000001';
        const loadModelsId = '00000000-0000-0000-0000-000000000002';
        const upscaleId = '00000000-0000-0000-0000-000000000003';

        const nodes: Node[] = [
            {
                id: loadImagesId,
                type: 'regularNode',
                position: { x: 0, y: 0 },
                data: { id: loadImagesId, schemaId: 'test:loadImages', inputData: {} },
            },
            {
                id: loadModelsId,
                type: 'regularNode',
                position: { x: 0, y: 100 },
                data: { id: loadModelsId, schemaId: 'test:loadModels', inputData: {} },
            },
            {
                id: upscaleId,
                type: 'regularNode',
                position: { x: 200, y: 50 },
                data: { id: upscaleId, schemaId: 'test:upscale', inputData: {} },
            },
        ];

        // Create edges connecting both generators to the upscale node
        const edges: Edge[] = [
            {
                id: 'e1',
                source: loadImagesId,
                sourceHandle: `${loadImagesId}-0`,
                target: upscaleId,
                targetHandle: `${upscaleId}-0`,
            },
            {
                id: 'e2',
                source: loadModelsId,
                sourceHandle: `${loadModelsId}-0`,
                target: upscaleId,
                targetHandle: `${upscaleId}-1`,
            },
        ];

        // Create ChainLineage
        const chainLineage = new ChainLineage(schemaMap, nodes, edges);

        // Test that the upscale node has a lineage (from first iterated input)
        const upscaleLineage = chainLineage.getInputLineage(upscaleId);
        expect(upscaleLineage).not.toBeNull();

        // Test that both generator outputs have their own lineages
        const loadImagesLineage = chainLineage.getOutputLineage({
            nodeId: loadImagesId,
            outputId: 0,
        });
        const loadModelsLineage = chainLineage.getOutputLineage({
            nodeId: loadModelsId,
            outputId: 0,
        });

        expect(loadImagesLineage).not.toBeNull();
        expect(loadModelsLineage).not.toBeNull();
        expect(loadImagesLineage?.equals(loadModelsLineage!)).toBe(false);

        // Test that the upscale node's output has the lineage of the first iterated input
        const upscaleOutputLineage = chainLineage.getOutputLineage({
            nodeId: upscaleId,
            outputId: 0,
        });
        expect(upscaleOutputLineage?.equals(loadImagesLineage!)).toBe(true);

        // Test that we can get the lineage of each connected input
        const imageInputLineage = chainLineage.getConnectedOutputLineage({
            nodeId: upscaleId,
            inputId: 0,
        });
        const modelInputLineage = chainLineage.getConnectedOutputLineage({
            nodeId: upscaleId,
            inputId: 1,
        });

        expect(imageInputLineage?.equals(loadImagesLineage!)).toBe(true);
        expect(modelInputLineage?.equals(loadModelsLineage!)).toBe(true);
    });
});
