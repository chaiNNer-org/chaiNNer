import { useDisclosure } from '@chakra-ui/react';
import React, { memo } from 'react';
import { createContext } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { useMemoObject } from '../hooks/useMemo';

interface NodeDocumentationContextState {
    selectedSchemaId: SchemaId | undefined;
    isOpen: boolean;
    openNodeDocumentation: (schemaId?: SchemaId) => void;
    onClose: () => void;
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
