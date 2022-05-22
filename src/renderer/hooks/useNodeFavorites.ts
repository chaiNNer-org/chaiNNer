import { useCallback, useMemo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { SettingsContext } from '../contexts/SettingsContext';

export interface UseNodeFavorites {
    readonly favorites: ReadonlySet<string>;
    readonly addFavorites: (...schemaIds: string[]) => void;
    readonly removeFavorite: (schemaId: string) => void;
}

export const useNodeFavorites = () => {
    const [favoritesArray, setFavorites] = useContextSelector(
        SettingsContext,
        (c) => c.useNodeFavorites
    );

    const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

    const addFavorites = useCallback(
        (...schemaIds: string[]) => {
            setFavorites((prev) => [...new Set([...prev, ...schemaIds])]);
        },
        [setFavorites]
    );
    const removeFavorite = useCallback(
        (schemaId: string) => {
            setFavorites((prev) => prev.filter((id) => id !== schemaId));
        },
        [setFavorites]
    );

    let value: UseNodeFavorites = { favorites, addFavorites, removeFavorite };
    value = useMemo(() => value, Object.values(value));

    return value;
};
