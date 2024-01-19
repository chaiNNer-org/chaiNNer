import { Edge, Node } from 'reactflow';
import { EdgeData, NodeData, NodeSchema } from '../common-types';
import { SchemaMap } from '../SchemaMap';
import {
    EMPTY_ARRAY,
    ParsedSourceHandle,
    ParsedTargetHandle,
    assertNever,
    groupBy,
    parseSourceHandle,
    stringifyTargetHandle,
} from '../util';

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
    readonly schemata: SchemaMap;

    private readonly nodeSchemata: ReadonlyMap<string, NodeSchema>;

    private readonly byTargetNode: ReadonlyMap<string, readonly Edge<EdgeData>[]>;

    private readonly byTargetHandle: ReadonlyMap<string, Edge<EdgeData>>;

    private readonly nodeLineageCache = new Map<string, Lineage | null>();

    constructor(
        schemata: SchemaMap,
        nodes: readonly Node<NodeData>[],
        edges: readonly Edge<EdgeData>[]
    ) {
        this.schemata = schemata;
        this.nodeSchemata = new Map(nodes.map((n) => [n.id, schemata.get(n.data.schemaId)]));

        this.byTargetHandle = new Map(edges.map((e) => [e.targetHandle!, e] as const));
        this.byTargetNode = groupBy(edges, (e) => e.target);
    }

    static readonly EMPTY: ChainLineage = new ChainLineage(SchemaMap.EMPTY, [], []);

    getEdgeByTarget(handle: ParsedTargetHandle): Edge<EdgeData> | undefined {
        return this.byTargetHandle.get(stringifyTargetHandle(handle));
    }

    /**
     * Returns the single lineage (if any) of all iterated inputs of the given node.
     *
     * Note: regular nodes are auto-iterated, so their lineage is that of the first iterated input (if any).
     *
     * Note: the input lineage of collector nodes is `null` if there are no connected iterated inputs (invalid chain).
     */
    getInputLineage(nodeId: string): Lineage | null {
        const schema = this.nodeSchemata.get(nodeId);
        if (!schema) return null;

        switch (schema.nodeType) {
            case 'newIterator': {
                // iterator source nodes do not support iterated inputs
                return null;
            }
            case 'regularNode': {
                // regular nodes are auto-iterated, so their lineage is that of the first iterated input
                let lineage = this.nodeLineageCache.get(nodeId);
                if (lineage === undefined) {
                    lineage = null;

                    const edges = this.byTargetNode.get(nodeId) ?? EMPTY_ARRAY;
                    for (const edge of edges) {
                        const inputLineage = this.getOutputLineage(
                            parseSourceHandle(edge.sourceHandle!)
                        );
                        if (inputLineage !== null) {
                            lineage = inputLineage;
                            break;
                        }
                    }

                    this.nodeLineageCache.set(nodeId, lineage);
                }
                return lineage;
            }
            case 'collector': {
                // collectors already return non-iterator outputs
                let lineage = this.nodeLineageCache.get(nodeId);
                if (lineage === undefined) {
                    lineage = null;

                    if (schema.iteratorInputs.length !== 1) {
                        throw new Error(
                            `Collector nodes should have exactly 1 iterator input info (${schema.schemaId})`
                        );
                    }
                    const info = schema.iteratorInputs[0];

                    for (const inputId of info.inputs) {
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

                    this.nodeLineageCache.set(nodeId, lineage);
                }
                return lineage;
            }
            default:
                return assertNever(schema.nodeType);
        }
    }

    /**
     * Returns the lineage of the given specific output.
     */
    getOutputLineage({ nodeId, outputId }: ParsedSourceHandle): Lineage | null {
        const schema = this.nodeSchemata.get(nodeId);
        if (!schema) return null;

        switch (schema.nodeType) {
            case 'regularNode': {
                // for regular nodes, the lineage of all outputs is equal to
                // the lineage of the first iterated input (if any).
                return this.getInputLineage(nodeId);
            }
            case 'newIterator': {
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
            default:
                return assertNever(schema.nodeType);
        }
    }
}
