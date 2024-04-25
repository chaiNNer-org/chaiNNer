import { useCallback } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { DisabledStatus, getDisabledStatus } from '../../common/nodes/disabled';
import { noop } from '../../common/util';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { useMemoObject } from './useMemo';

export interface UseDisabled {
    readonly canDisable: boolean;
    readonly isDirectlyDisabled: boolean;
    readonly status: DisabledStatus;
    readonly setDirectlyDisabled: (value: boolean) => void;
}

export const NO_DISABLED: UseDisabled = {
    canDisable: false,
    isDirectlyDisabled: false,
    status: DisabledStatus.Enabled,
    setDirectlyDisabled: noop,
};

export const useDisabled = (data: NodeData): UseDisabled => {
    const { id, isDisabled, schemaId } = data;

    const status = useContextSelector(GlobalVolatileContext, (c) =>
        getDisabledStatus(data, c.effectivelyDisabledNodes)
    );
    const { setNodeDisabled } = useContext(GlobalContext);
    const { schemata } = useContext(BackendContext);

    const schema = schemata.get(schemaId);

    return useMemoObject<UseDisabled>({
        canDisable: schema.hasSideEffects || schema.outputs.length > 0,
        isDirectlyDisabled: isDisabled ?? false,
        status,
        setDirectlyDisabled: useCallback(
            (value) => setNodeDisabled(id, value),
            [setNodeDisabled, id]
        ),
    });
};
