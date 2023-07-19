import { useDisclosure } from '@chakra-ui/react';
import MiniSearch, { SearchResult } from 'minisearch';
import React, { memo, useMemo, useState } from 'react';
import { createContext, useContext } from 'use-context-selector';
import { NodeSchema, SchemaId } from '../../common/common-types';
import { useMemoObject } from '../hooks/useMemo';
import { BackendContext } from './BackendContext';

interface NodeDocumentationContextState {
    selectedSchemaId: SchemaId | undefined;
    isOpen: boolean;
    openNodeDocumentation: (schemaId?: SchemaId) => void;
    onClose: () => void;
    nodeDocsSearchState: {
        searchQuery: string;
        setSearchQuery: (query: string) => void;
        searchResults: readonly SearchResult[];
        searchTerms: readonly string[];
    };
}

// TODO: create context requires default values
export const NodeDocumentationContext = createContext<NodeDocumentationContextState>(
    {} as NodeDocumentationContextState
);

export const NodeDocumentationProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [selectedSchemaId, setSelectedSchemaId] = useState<SchemaId | undefined>(undefined);

    const openNodeDocumentation = (schemaId?: SchemaId) => {
        setSelectedSchemaId(schemaId);
        onOpen();
    };

    const { schemata } = useContext(BackendContext);
    const miniSearch = useMemo(() => {
        const idField: keyof NodeSchema = 'schemaId';
        const fields: (keyof NodeSchema)[] = [
            'category',
            'description',
            'name',
            'subcategory',
            'inputs',
            'outputs',
        ];

        const search = new MiniSearch<NodeSchema>({
            idField,
            fields,

            extractField: (document, fieldName): string => {
                if (fieldName === 'inputs' || fieldName === 'outputs') {
                    return document[fieldName]
                        .map((i) => `${i.label} ${i.description ?? ''}`)
                        .join('\n\n');
                }
                return String((document as unknown as Record<string, unknown>)[fieldName]);
            },
        });
        search.addAll(schemata.schemata);
        return search;
    }, [schemata]);

    const [searchQuery, setSearchQuery] = useState('');

    const nodeDocsSearchState =
        useMemo((): NodeDocumentationContextState['nodeDocsSearchState'] => {
            const searchResults = miniSearch.search(searchQuery, {
                boost: { name: 2 },
                fuzzy: 0.2,
                prefix: true,
                combineWith: 'AND',
            });

            return {
                searchQuery,
                setSearchQuery,
                searchResults,
                searchTerms: searchResults.find((s) => s.id === selectedSchemaId)?.terms ?? [],
            };
        }, [searchQuery, setSearchQuery, selectedSchemaId, miniSearch]);

    const contextValue = useMemoObject<NodeDocumentationContextState>({
        selectedSchemaId,
        isOpen,
        openNodeDocumentation,
        onClose,
        nodeDocsSearchState,
    });

    return (
        <NodeDocumentationContext.Provider value={contextValue}>
            {children}
        </NodeDocumentationContext.Provider>
    );
});
