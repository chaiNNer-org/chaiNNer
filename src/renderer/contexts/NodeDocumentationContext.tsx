import { useDisclosure } from '@chakra-ui/react';
import React, { memo, useCallback, useState } from 'react';
import { createContext, useContextSelector } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { useMemoObject } from '../hooks/useMemo';
import { BackendContext } from './BackendContext';

interface NodeDocumentationContextState {
    selectedSchemaId: SchemaId;
    isOpen: boolean;
    openNodeDocumentation: (schemaId?: SchemaId) => void;
    onClose: () => void;
}

// TODO: create context requires default values
export const NodeDocumentationContext = createContext<NodeDocumentationContextState>(
    {} as NodeDocumentationContextState,
);

export const NodeDocumentationProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const defaultSchemaId = useContextSelector(
        BackendContext,
        (context) => context.schemata.schemata[0].schemaId,
    );
    const [selectedSchemaId, setSelectedSchemaId] = useState<SchemaId>(defaultSchemaId);

    const { isOpen, onOpen, onClose } = useDisclosure();

    const openNodeDocumentation = useCallback(
        (schemaId?: SchemaId): void => {
            if (schemaId !== undefined) {
                setSelectedSchemaId(schemaId);
            }
            onOpen();
        },
        [onOpen],
    );

    const contextValue = useMemoObject({
        selectedSchemaId,
        isOpen,
        openNodeDocumentation,
        onClose,
    });

    return (
        <NodeDocumentationContext.Provider value={contextValue}>
            {children}
        </NodeDocumentationContext.Provider>
    );
});
