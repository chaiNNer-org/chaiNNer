import isDeepEqual from 'fast-deep-equal/react';
import { useCallback, useState } from 'react';
import { OutputData } from '../../common/common-types';
import { EMPTY_MAP } from '../../common/util';
import { useMemoObject } from './useMemo';

export interface OutputDataEntry {
    inputHash: string;
    lastExecutionTime: number | undefined;
    data: OutputData | undefined;
}

export interface OutputDataActions {
    set(
        nodeId: string,
        executionTime: number | undefined,
        nodeInputHash: string,
        data: OutputData | undefined
    ): void;
    delete(nodeId: string): void;
    clear(): void;
}

export const useOutputDataStore = () => {
    const [map, setMap] = useState<ReadonlyMap<string, OutputDataEntry>>(EMPTY_MAP);

    const actions: OutputDataActions = {
        set: useCallback(
            (nodeId, executionTime, inputHash, data) => {
                setMap((prev) => {
                    const existingEntry = prev.get(nodeId);

                    const useExistingData = existingEntry?.data && !data;
                    const entry: OutputDataEntry = {
                        data: useExistingData ? existingEntry.data : data,
                        inputHash: useExistingData ? existingEntry.inputHash : inputHash,
                        lastExecutionTime: executionTime ?? existingEntry?.lastExecutionTime,
                    };

                    if (!existingEntry || !isDeepEqual(existingEntry, entry)) {
                        const newMap = new Map(prev);
                        newMap.set(nodeId, entry);
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
        clear: useCallback(() => {
            setMap(EMPTY_MAP);
        }, [setMap]),
    };

    return [map, useMemoObject(actions)] as const;
};
