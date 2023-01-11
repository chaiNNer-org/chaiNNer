import { useCallback } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { DisabledStatus, getDisabledStatus } from '../../common/nodes/disabled';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { useMemoObject } from './useMemo';

export interface UseDisabled {
    readonly canDisable: boolean;
    readonly isDirectlyDisabled: boolean;
    readonly status: DisabledStatus;
    readonly toggleDirectlyDisabled: () => void;
}

export const useDisabled = (data: NodeData): UseDisabled => {
    const { id, isDisabled, schemaId } = data;

    const effectivelyDisabledNodes = useContextSelector(
        GlobalVolatileContext,
        (c) => c.effectivelyDisabledNodes
    );
    const { setNodeDisabled } = useContext(GlobalContext);
    const { schemata } = useContext(BackendContext);

    const schema = schemata.get(schemaId);

    return useMemoObject<UseDisabled>({
        canDisable:
            (schema.hasSideEffects || schema.outputs.length > 0) &&
            schema.nodeType !== 'iteratorHelper',
        isDirectlyDisabled: isDisabled ?? false,
        status: getDisabledStatus(data, effectivelyDisabledNodes),
        toggleDirectlyDisabled: useCallback(
            () => setNodeDisabled(id, !isDisabled),
            [setNodeDisabled, id, isDisabled]
        ),
    });
};
