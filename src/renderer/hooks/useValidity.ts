import { useEffect, useMemo, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { useContextSelector } from 'use-context-selector';
import { EdgeData, InputData, NodeData, NodeSchema } from '../../common/common-types';
import { checkNodeValidity, checkRequiredInputs } from '../../common/nodes/checkNodeValidity';
import { getConnectedInputs } from '../../common/nodes/connectedInputs';
import { VALID, Validity, invalid } from '../../common/Validity';
import { GlobalVolatileContext } from '../contexts/GlobalNodeState';

const STARTING_VALIDITY: Validity = invalid('Validating nodes...');

export interface UseValidity {
    validity: Validity;
}

export const useValidity = (id: string, schema: NodeSchema, inputData: InputData): UseValidity => {
    const edgeChanges = useContextSelector(GlobalVolatileContext, (c) => c.edgeChanges);
    const functionInstance = useContextSelector(GlobalVolatileContext, (c) =>
        c.typeState.functions.get(id)
    );
    const { getEdges } = useReactFlow<NodeData, EdgeData>();

    const alwaysValid = schema.inputs.length === 0;

    const guaranteedMissingInputs = useMemo(
        (): Validity => checkRequiredInputs(schema, inputData),
        [schema, inputData]
    );

    const [fullValidity, setFullValidity] = useState<Validity>(
        alwaysValid ? VALID : STARTING_VALIDITY
    );
    useEffect(() => {
        if (!alwaysValid) {
            setFullValidity(
                checkNodeValidity({
                    schema,
                    inputData,
                    connectedInputs: getConnectedInputs(id, getEdges()),
                    functionInstance,
                })
            );
        }
    }, [alwaysValid, id, schema, inputData, edgeChanges, getEdges, functionInstance]);

    // The problem with `checkNodeValidity` is that is must be computed with a delay due to
    // `getEdges`. This means that the full validity we return here might be outdated. This is a
    // problem when other aspects of the problem rely on the fact that that valid nodes can be
    // executed. To mitigate (but unfortunately not fully fix) this problem, we also synchronously
    // compute an approximate conservative validity. This second validity will only be invalid, if
    // the node is guaranteed to be invalid, but it might be valid even though the node is
    // actually invalid.
    const validity =
        fullValidity.isValid && !guaranteedMissingInputs.isValid
            ? guaranteedMissingInputs
            : fullValidity;

    return { validity };
};
