import { getIncomers, useReactFlow } from 'reactflow';
import { useContext } from 'use-context-selector';
import { EdgeData, NodeData, SchemaId } from '../../common/common-types';
import { BackendContext } from '../contexts/BackendContext';

/**
 * Determines whether a node should use automatic ahead-of-time features, such as individually running the node or determining certain type features automatically.
 */
export const useAutomaticFeatures = (id: string, schemaId: SchemaId) => {
    const { schemata } = useContext(BackendContext);
    const schema = schemata.get(schemaId);

    const { getEdges, getNodes, getNode } = useReactFlow<NodeData, EdgeData>();
    const thisNode = getNode(id);

    // A node should not use automatic features if it has incoming connections
    const hasIncomingConnections =
        thisNode && getIncomers(thisNode, getNodes(), getEdges()).length > 0;

    // If the node is an iterator, it should not use automatic features
    const isNewIterator = schema.kind === 'newIterator';
    // Same if it has any static input values
    const hasStaticValueInput = schema.inputs.some((i) => i.kind === 'static');
    // We should only use automatic features if the node has side effects
    const { hasSideEffects } = schema;

    return {
        isAutomatic:
            hasSideEffects && !hasIncomingConnections && !isNewIterator && !hasStaticValueInput,
        hasIncomingConnections,
    };
};
