import { Edge, Node } from 'reactflow';
import { EdgeData, NodeData } from '../common-types';
import { PassthroughMap } from '../PassthroughMap';
import { SchemaMap } from '../SchemaMap';
import {
    getDefaultValue,
    parseSourceHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../util';
import { getEffectivelyDisabledNodes } from './disabled';
import { getNodesWithSideEffects } from './sideEffect';

type N = Node<NodeData>;
type E = Edge<EdgeData>;

const trimEdges = (nodes: N[], edges: readonly E[]): Chain => {
    const nodeIds = new Set<string>();
    for (const n of nodes) {
        nodeIds.add(n.id);
    }

    return {
        nodes,
        edges: edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)),
    };
};

const removeUnusedSideEffectNodes = (nodes: N[], edges: E[], schemata: SchemaMap): N[] => {
    // eslint-disable-next-line no-param-reassign
    edges = trimEdges(nodes, edges).edges;

    const connectedNodes = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);

    return nodes.filter((n) => {
        if (connectedNodes.has(n.id)) {
            // the node isn't unused
            return true;
        }

        const schema = schemata.get(n.data.schemaId);
        if (!schema.hasSideEffects) {
            // we only care about nodes with side effects
            return true;
        }

        // if all inputs don't require connections, that's fine too
        const requireConnection = schema.inputs.some(
            (i) => !i.optional && getDefaultValue(i) === undefined
        );
        if (!requireConnection) {
            return true;
        }

        // the is unused, has side effects, and requires connections
        return false;
    });
};

interface OptimizationReport {
    /** How many effectively disabled nodes were removed. */
    removedDisabled: number;
    /** How many side-effect-free nodes were removed. */
    removedSideEffectFree: number;
}
const combineReports = (...reports: readonly Partial<OptimizationReport>[]): OptimizationReport => {
    const acc: OptimizationReport = {
        removedDisabled: 0,
        removedSideEffectFree: 0,
    };
    for (const r of reports) {
        acc.removedDisabled += r.removedDisabled ?? 0;
        acc.removedSideEffectFree += r.removedSideEffectFree ?? 0;
    }
    return acc;
};

interface Chain {
    readonly nodes: N[];
    readonly edges: E[];
}
interface Context {
    readonly schemata: SchemaMap;
    readonly passthrough: PassthroughMap;
}
interface Optimized {
    chain: Chain;
    report: Partial<OptimizationReport>;
}
type Optimization = (chain: Chain, context: Context) => Optimized;

const removeDisabledNodes: Optimization = ({ nodes, edges }, { schemata }) => {
    // remove disabled nodes
    const disabledNodes = new Set(getEffectivelyDisabledNodes(nodes, edges, schemata));
    if (disabledNodes.size === 0) {
        // nothing to do
        return { chain: { nodes, edges }, report: {} };
    }

    const enabledNodes = nodes.filter((n) => !disabledNodes.has(n));

    return {
        chain: trimEdges(enabledNodes, edges),
        report: {
            removedDisabled: disabledNodes.size,
        },
    };
};
const removeSideEffectFreeNodes: Optimization = ({ nodes, edges }, { schemata }) => {
    // remove nodes without side effects
    let withEffect = getNodesWithSideEffects(nodes, edges, schemata);
    withEffect = removeUnusedSideEffectNodes(withEffect, edges, schemata);

    return {
        chain: trimEdges(withEffect, edges),
        report: {
            removedSideEffectFree: nodes.length - withEffect.length,
        },
    };
};
const removePassthroughNodes: Optimization = ({ nodes, edges }, { passthrough }) => {
    const inputToOutputMap = new Map<string, string>();
    for (const node of nodes) {
        if (node.data.isPassthrough) {
            const info = passthrough.get(node.data.schemaId);
            if (info) {
                for (const [outputId, inputId] of info.mapping) {
                    inputToOutputMap.set(
                        stringifyTargetHandle({ nodeId: node.id, inputId }),
                        stringifySourceHandle({ nodeId: node.id, outputId })
                    );
                }
            }
        }
    }
    if (inputToOutputMap.size === 0) {
        // nothing to do
        return { chain: { nodes, edges }, report: {} };
    }

    // which source handles should be changed to which new source handles
    const sourceHandleRemapping = new Map<string, string>();
    for (const { sourceHandle, targetHandle } of edges) {
        if (sourceHandle && targetHandle) {
            const passthroughSourceHandle = inputToOutputMap.get(targetHandle);
            if (passthroughSourceHandle) {
                sourceHandleRemapping.set(passthroughSourceHandle, sourceHandle);
            }
        }
    }

    // change edges to skip passthrough nodes
    const newEdges = edges.map((e): E => {
        if (e.sourceHandle) {
            const newSourceHandle = sourceHandleRemapping.get(e.sourceHandle);
            if (newSourceHandle) {
                return {
                    ...e,
                    sourceHandle: newSourceHandle,
                    source: parseSourceHandle(newSourceHandle).nodeId,
                    sourceNode: undefined,
                };
            }
        }

        return e;
    });

    return {
        chain: { nodes, edges: newEdges },
        report: {},
    };
};

const optimizations: readonly Optimization[] = [
    removeDisabledNodes,
    removePassthroughNodes,
    removeSideEffectFreeNodes,
];

const runAllOptimizations = (chain: Chain, context: Context): OptimizedChain => {
    let report: OptimizationReport = combineReports();
    let currentChain = chain;
    for (const optimization of optimizations) {
        const optimized = optimization(currentChain, context);
        currentChain = optimized.chain;
        report = combineReports(report, optimized.report);
    }
    return { ...currentChain, report };
};

interface OptimizedChain {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
    report: OptimizationReport;
}
export const optimizeChain = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap,
    passthrough: PassthroughMap
): OptimizedChain => {
    const maxPasses = 10;

    const context: Context = { schemata, passthrough };
    const result = runAllOptimizations({ nodes: [...nodes], edges: [...edges] }, context);
    for (let i = 1; i < maxPasses; i += 1) {
        const nextResult = runAllOptimizations(result, context);
        if (
            nextResult.nodes.length === result.nodes.length &&
            nextResult.edges.length === result.edges.length
        ) {
            // no changes
            break;
        }

        result.nodes = nextResult.nodes;
        result.edges = nextResult.edges;
        result.report = combineReports(result.report, nextResult.report);
    }

    return result;
};
