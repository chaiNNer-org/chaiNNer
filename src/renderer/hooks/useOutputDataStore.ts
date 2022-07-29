import isDeepEqual from 'fast-deep-equal/react';
import { useCallback, useState } from 'react';
import { OutputData } from '../../common/common-types';
import { EMPTY_MAP } from '../../common/util';
import { useMemoObject } from './useMemo';

export interface OutputDataEntry {
    inputHash: string;
    data: OutputData;
}

export interface OutputDataActions {
    set(nodeId: string, nodeInputHash: string, data: OutputData): void;
    delete(nodeId: string): void;
}

export const useOutputDataStore = () => {
    const [map, setMap] = useState<ReadonlyMap<string, OutputDataEntry>>(EMPTY_MAP);

    const actions: OutputDataActions = {
        set: useCallback(
            (nodeId, inputHash, data) => {
                setMap((prev) => {
                    const existingData = prev.get(nodeId);
                    if (!existingData || !isDeepEqual(existingData, data)) {
                        const newMap = new Map(prev);
                        newMap.set(nodeId, { data, inputHash });
                        return newMap;
                    }
                    return prev;
                });
            },
            [setMap]
        ),
        delete: useCallback(
            (nodeId) => {
                setMap((prev) => {
                    if (!prev.has(nodeId)) return prev;
                    const newMap = new Map(prev);
                    newMap.delete(nodeId);
                    return newMap;
                });
            },
            [setMap]
        ),
    };

    return [map, useMemoObject(actions)] as const;
};
