import { Edge, Node } from 'reactflow';
import { EdgeData, InputId, NodeData, NodeSchema } from '../common-types';
import { SchemaMap } from '../SchemaMap';
import {
    EMPTY_ARRAY,
    EMPTY_SET,
    ParsedSourceHandle,
    ParsedTargetHandle,
    assertNever,
    groupBy,
    parseSourceHandle,
    parseTargetHandle,
    stringifyTargetHandle,
} from '../util';

/**
 * Returns whether a node of this schema can be auto iterated.
 */
export const isAutoIterable = (schema: NodeSchema): boolean => {
    return schema.kind === 'regularNode' && schema.inputs.some((i) => i.hasHandle);
};

/**
 * Represents the iterator lineage of an output.
 *
 * Note: this class only provides a minimal interface to enable future extensions.
 */
export class Lineage {
    private readonly sourceNode: string;

    private constructor(sourceNode: string) {
        this.sourceNode = sourceNode;
    }

    equals(other: Lineage): boolean {
        return this.sourceNode === other.sourceNode;
    }

    static fromSourceNode(nodeId: string): Lineage {
        return new Lineage(nodeId);
    }
}

export class ChainLineage {
    private readonly nodeSchemata: ReadonlyMap<string, NodeSchema>;

    private readonly byTargetNode: ReadonlyMap<string, readonly Edge<EdgeData>[]>;

    private readonly byTargetHandle: ReadonlyMap<string, Edge<EdgeData>>;

    private readonly nodeLineageCache = new Map<string, Lineage | null>();

    constructor(
        schemata: SchemaMap,
        nodes: readonly Node<NodeData>[],
        edges: readonly Edge<EdgeData>[]
    ) {
        this.nodeSchemata = new Map(nodes.map((n) => [n.id, schemata.get(n.data.schemaId)]));

        this.byTargetHandle = new Map(edges.map((e) => [e.targetHandle!, e] as const));
        this.byTargetNode = groupBy(edges, (e) => e.target);
    }

    static readonly EMPTY: ChainLineage = new ChainLineage(SchemaMap.EMPTY, [], []);

    private getEdgeByTarget(handle: ParsedTargetHandle): Edge<EdgeData> | undefined {
        return this.byTargetHandle.get(stringifyTargetHandle(handle));
    }

    private getInputLineageImpl(
        nodeId: string,
        schema: NodeSchema,
        exclude: ReadonlySet<InputId>
    ): Lineage | null {
        switch (schema.kind) {
            case 'generator': {
                // iterator source nodes do not support iterated inputs
                return null;
            }
            case 'regularNode': {
                // regular nodes are auto-iterated, so their lineage is that of the first iterated input
                let lineage: Lineage | null = null;

                const edges = this.byTargetNode.get(nodeId) ?? EMPTY_ARRAY;
                for (const edge of edges) {
                    if (
                        exclude.size > 0 &&
                        exclude.has(parseTargetHandle(edge.targetHandle!).inputId)
                    ) {
                        // eslint-disable-next-line no-continue
                        continue;
                    }

                    const inputLineage = this.getOutputLineage(
                        parseSourceHandle(edge.sourceHandle!)
                    );
                    if (inputLineage !== null) {
                        lineage = inputLineage;
                        break;
                    }
                }

                return lineage;
            }
            case 'collector': {
                // collectors already return non-iterator outputs
                let lineage: Lineage | null = null;

                if (schema.iteratorInputs.length !== 1) {
                    throw new Error(
                        `Collector nodes should have exactly 1 iterator input info (${schema.schemaId})`
                    );
                }
                const info = schema.iteratorInputs[0];

                for (const inputId of info.inputs) {
                    // eslint-disable-next-line no-continue
                    if (exclude.has(inputId)) continue;

                    const edge = this.getEdgeByTarget({ nodeId, inputId });
                    // eslint-disable-next-line no-continue
                    if (!edge) continue;

                    const handle = parseSourceHandle(edge.sourceHandle!);
                    const inputLineage = this.getOutputLineage(handle);
                    if (inputLineage !== null) {
                        lineage = inputLineage;
                        break;
                    }
                }

                return lineage;
            }
            case 'transformer': {
                // transformer nodes consume an iterator and produce a new one
                let lineage: Lineage | null = null;

                if (schema.iteratorInputs.length !== 1) {
                    throw new Error(
                        `Transformer nodes should have exactly 1 iterator input info (${schema.schemaId})`
                    );
                }
                const info = schema.iteratorInputs[0];

                for (const inputId of info.inputs) {
                    // eslint-disable-next-line no-continue
                    if (exclude.has(inputId)) continue;

                    const edge = this.getEdgeByTarget({ nodeId, inputId });
                    // eslint-disable-next-line no-continue
                    if (!edge) continue;

                    const handle = parseSourceHandle(edge.sourceHandle!);
                    const inputLineage = this.getOutputLineage(handle);
                    if (inputLineage !== null) {
                        lineage = inputLineage;
                        break;
                    }
                }

                return lineage;
            }
            default:
                return assertNever(schema.kind);
        }
    }

    /**
     * Returns the single lineage (if any) of all iterated inputs of the given node.
     *
     * Note: regular nodes are auto-iterated, so their lineage is that of the first iterated input (if any).
     *
     * Note: the input lineage of collector nodes is `null` if there are no connected iterated inputs (invalid chain).
     */
    getInputLineage(
        nodeId: string,
        { exclude }: { exclude?: ReadonlySet<InputId> } = {}
    ): Lineage | null {
        const schema = this.nodeSchemata.get(nodeId);
        if (!schema) return null;

        const useCache = exclude === undefined || exclude.size === 0;

        if (!useCache) {
            return this.getInputLineageImpl(nodeId, schema, exclude);
        }

        let lineage = this.nodeLineageCache.get(nodeId);
        if (lineage === undefined) {
            lineage = this.getInputLineageImpl(nodeId, schema, EMPTY_SET);
            this.nodeLineageCache.set(nodeId, lineage);
        }
        return lineage;
    }

    /**
     * Returns the lineage of the given specific output.
     */
    getOutputLineage({ nodeId, outputId }: ParsedSourceHandle): Lineage | null {
        const schema = this.nodeSchemata.get(nodeId);
        if (!schema) return null;

        switch (schema.kind) {
            case 'regularNode': {
                // for regular nodes, the lineage of all outputs is equal to
                // the lineage of the first iterated input (if any).
                return this.getInputLineage(nodeId);
            }
            case 'generator': {
                // iterator source nodes create a new lineage
                if (schema.iteratorOutputs.length !== 1) {
                    throw new Error(
                        `Iterator nodes should have exactly 1 iterator output info (${schema.schemaId})`
                    );
                }
                const info = schema.iteratorOutputs[0];
                return info.outputs.includes(outputId) ? Lineage.fromSourceNode(nodeId) : null;
            }
            case 'collector': {
                // collectors already return non-iterator outputs
                return null;
            }
            case 'transformer': {
                // transformer nodes create a new lineage
                if (schema.iteratorOutputs.length !== 1) {
                    throw new Error(
                        `Transformer nodes should have exactly 1 iterator output info (${schema.schemaId})`
                    );
                }
                const info = schema.iteratorOutputs[0];
                return info.outputs.includes(outputId) ? Lineage.fromSourceNode(nodeId) : null;
            }
            default:
                return assertNever(schema.kind);
        }
    }

    /**
     * Returns `getOutputLineage` for the source handle connected to the given target handle.
     * If no such connection exists, returns `undefined`.
     *
     */
    getConnectedOutputLineage(target: ParsedTargetHandle): Lineage | null | undefined {
        const edge = this.getEdgeByTarget(target);
        if (!edge) return undefined;
        return this.getOutputLineage(parseSourceHandle(edge.sourceHandle!));
    }
}
