import isDeepEqual from 'fast-deep-equal/react';
import { useCallback, useState } from 'react';
import { IterOutputTypes, OutputData, OutputTypes } from '../../common/common-types';
import { EMPTY_MAP } from '../../common/util';
import { useMemoObject } from './useMemo';

export interface OutputDataEntry {
    inputHash: string;
    lastExecutionTime: number | undefined;
    data: OutputData | undefined;
    types: OutputTypes | undefined;
    sequenceTypes: IterOutputTypes | undefined;
}

export interface OutputDataActions {
    set(
        nodeId: string,
        executionTime: number | undefined,
        nodeInputHash: string,
        data: OutputData | undefined,
        types: OutputTypes | undefined,
        sequenceTypes: IterOutputTypes | undefined
    ): void;
    delete(nodeId: string): void;
    clear(): void;
}

export const useOutputDataStore = () => {
    const [map, setMap] = useState<ReadonlyMap<string, OutputDataEntry>>(EMPTY_MAP);

    const actions: OutputDataActions = {
        set: useCallback(
            (nodeId, executionTime, inputHash, data, types, sequenceTypes) => {
                setMap((prev) => {
                    const existingEntry = prev.get(nodeId);

                    const useExisting = existingEntry?.data && !data && !types;
                    const entry: OutputDataEntry = {
                        data: useExisting ? existingEntry.data : data,
                        types: useExisting ? existingEntry.types : types,
                        sequenceTypes: useExisting ? existingEntry.sequenceTypes : sequenceTypes,
                        inputHash: useExisting ? existingEntry.inputHash : inputHash,
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
