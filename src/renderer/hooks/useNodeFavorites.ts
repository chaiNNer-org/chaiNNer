import { useCallback, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { SettingsContext } from '../contexts/SettingsContext';
import { useMemoObject } from './useMemo';

export interface UseNodeFavorites {
    readonly favorites: ReadonlySet<SchemaId>;
    readonly addFavorites: (...schemaIds: SchemaId[]) => void;
    readonly removeFavorite: (schemaId: SchemaId) => void;
}

export const useNodeFavorites = () => {
    const [favoritesArray, setFavorites] = useContextSelector(
        SettingsContext,
        (c) => c.useNodeFavorites,
    );

    const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

    const addFavorites = useCallback(
        (...schemaIds: SchemaId[]) => {
            setFavorites((prev) => [...new Set([...prev, ...schemaIds])]);
        },
        [setFavorites],
    );
    const removeFavorite = useCallback(
        (schemaId: SchemaId) => {
            setFavorites((prev) => prev.filter((id) => id !== schemaId));
        },
        [setFavorites],
    );

    return useMemoObject<UseNodeFavorites>({ favorites, addFavorites, removeFavorite });
};
