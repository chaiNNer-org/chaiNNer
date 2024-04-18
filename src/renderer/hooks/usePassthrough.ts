import { useCallback } from 'react';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { PassthroughInfo } from '../../common/PassthroughMap';
import { noop } from '../../common/util';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { useMemoObject } from './useMemo';

export interface UsePassthrough {
    readonly isPassthrough: boolean;
    readonly canPassthrough: boolean;
    readonly info: PassthroughInfo | undefined;
    readonly toggle: () => void;
}

export const NO_PASSTHROUGH: UsePassthrough = {
    isPassthrough: false,
    canPassthrough: false,
    info: undefined,
    toggle: noop,
};

export const usePassthrough = (data: NodeData): UsePassthrough => {
    const { setNodePassthrough } = useContext(GlobalContext);
    const { passthrough } = useContext(BackendContext);

    const { isPassthrough, schemaId } = data;
    const info = passthrough.get(schemaId);
    const canPassthrough = info !== undefined;

    return useMemoObject<UsePassthrough>({
        isPassthrough: isPassthrough ?? false,
        canPassthrough,
        info,
        toggle: useCallback(() => {
            setNodePassthrough(data.id, canPassthrough && !isPassthrough);
        }, [setNodePassthrough, data.id, canPassthrough, isPassthrough]),
    });
};
