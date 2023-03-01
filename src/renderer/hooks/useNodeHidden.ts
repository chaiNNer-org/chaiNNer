import { useCallback, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { SettingsContext } from '../contexts/SettingsContext';
import { useMemoObject } from './useMemo';

export interface UseNodeHidden {
    readonly hidden: ReadonlySet<SchemaId>;
    readonly addHidden: (...schemaIds: SchemaId[]) => void;
    readonly removeHidden: (schemaId: SchemaId) => void;
}

export const useNodeHidden = () => {
    const [hiddenArray, setHidden] = useContextSelector(SettingsContext, (c) => c.useNodeHidden);

    const hidden = useMemo(() => new Set(hiddenArray), [hiddenArray]);

    const addHidden = useCallback(
        (...schemaIds: SchemaId[]) => {
            setHidden((prev) => [...new Set([...prev, ...schemaIds])]);
        },
        [setHidden]
    );
    const removeHidden = useCallback(
        (schemaId: SchemaId) => {
            setHidden((prev) => prev.filter((id) => id !== schemaId));
        },
        [setHidden]
    );

    return useMemoObject<UseNodeHidden>({ hidden, addHidden, removeHidden });
};
