import { useCallback, useMemo } from 'react';
import { SchemaId } from '../../common/common-types';
import { useMutSetting } from '../contexts/SettingsContext';
import { useMemoObject } from './useMemo';

export interface UseNodeFavorites {
    readonly favorites: ReadonlySet<SchemaId>;
    readonly addFavorites: (...schemaIds: SchemaId[]) => void;
    readonly removeFavorite: (schemaId: SchemaId) => void;
    readonly toggleFavorite: (schemaId: SchemaId) => void;
}

export const useNodeFavorites = () => {
    const [favoritesArray, setFavorites] = useMutSetting('favoriteNodes');

    const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

    const addFavorites = useCallback(
        (...schemaIds: SchemaId[]) => {
            setFavorites((prev) => [...new Set([...prev, ...schemaIds])]);
        },
        [setFavorites]
    );
    const removeFavorite = useCallback(
        (schemaId: SchemaId) => {
            setFavorites((prev) => prev.filter((id) => id !== schemaId));
        },
        [setFavorites]
    );
    const toggleFavorite = useCallback(
        (schemaId: SchemaId) => {
            setFavorites((prev) => {
                if (prev.includes(schemaId)) {
                    return prev.filter((id) => id !== schemaId);
                }
                return [...prev, schemaId];
            });
        },
        [setFavorites]
    );

    return useMemoObject<UseNodeFavorites>({
        favorites,
        addFavorites,
        removeFavorite,
        toggleFavorite,
    });
};
