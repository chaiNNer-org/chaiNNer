import { useEffect, useMemo, useState } from 'react';
import { useReactFlow } from 'react-flow-renderer';
import { useContextSelector } from 'use-context-selector';
import {
    VALID,
    Validity,
    checkNodeValidity,
    checkRequiredInputs,
} from '../../common/checkNodeValidity';
import { EdgeData, InputData, NodeData, NodeSchema } from '../../common/common-types';
import { GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { getConnectedInputs } from '../helpers/connectedInputs';

const STARTING_VALIDITY: Validity = {
    isValid: false,
    reason: 'Validating nodes...',
};

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

    const [fullValidity, setValidity] = useState<Validity>(alwaysValid ? VALID : STARTING_VALIDITY);
    useEffect(() => {
        if (!alwaysValid) {
            setValidity(
                checkNodeValidity({
                    schema,
                    inputData,
                    connectedInputs: getConnectedInputs(id, getEdges()),
                    functionInstance,
                })
            );
        }
    }, [id, schema, inputData, edgeChanges, functionInstance]);

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
