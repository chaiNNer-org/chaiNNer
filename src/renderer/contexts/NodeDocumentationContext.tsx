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
        searchResult: readonly SearchResult[];
        searchTerms: readonly string[];
    };
}

// TODO: create context requires default values
export const NodeDocumentationContext = createContext<NodeDocumentationContextState>(
    {} as NodeDocumentationContextState
);

export const NodeDocumentationProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [selectedSchemaId, setSelectedSchemaId] = React.useState<SchemaId | undefined>(undefined);

    const openNodeDocumentation = (schemaId?: SchemaId) => {
        setSelectedSchemaId(schemaId);
        onOpen();
    };

    const { schemata } = useContext(BackendContext);
    const schema = schemata.schemata;
    const searchableSchema = useMemo(() => {
        return schema.map((s) => ({
            ...s,
            inputs: s.inputs.map((i) => `${i.label} ${i.description ?? ''}`),
            outputs: s.outputs.map((o) => `${o.label} ${o.description ?? ''}`),
        }));
    }, [schema]);

    const [searchQuery, setSearchQuery] = useState('');

    const idField: keyof NodeSchema = 'schemaId';
    const fields: (keyof NodeSchema)[] = [
        'category',
        'description',
        'name',
        'subcategory',
        'inputs',
        'outputs',
    ];
    const miniSearch = new MiniSearch({ idField, fields });

    miniSearch.addAll(searchableSchema);

    const searchResult = miniSearch.search(searchQuery, {
        boost: { name: 2 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: 'AND',
    });

    const searchTerms = searchResult.find((s) => s.id === selectedSchemaId)?.terms ?? [];

    const nodeDocsSearchState = useMemo(() => ({
        searchQuery,
        setSearchQuery,
        searchResult,
        searchTerms,
    }), [searchQuery, setSearchQuery, searchResult, searchTerms]);

    const contextValue = useMemoObject({
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
