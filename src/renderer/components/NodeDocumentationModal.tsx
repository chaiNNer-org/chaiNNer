import {
    Button,
    HStack,
    Heading,
    IconButton,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Text,
    Tooltip,
    VStack,
} from '@chakra-ui/react';
import { memo } from 'react';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { useContext } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { BackendContext } from '../contexts/BackendContext';
import { NodeDocumentationContext } from '../contexts/NodeDocumentationContext';

interface NodeDocumentationModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedSchemaId: SchemaId | undefined;
}

export const NodeDocumentationModal = memo(
    ({ isOpen, onClose, selectedSchemaId }: NodeDocumentationModalProps) => {
        const { schemata } = useContext(BackendContext);

        const schema = schemata.schemata;
        const selectedSchema = schemata.get(selectedSchemaId ?? schema[0].schemaId);

        return (
            <Modal
                isCentered
                isOpen={isOpen}
                // scrollBehavior="inside"
                returnFocusOnClose={false}
                size="xl"
                onClose={onClose}
            >
                <ModalOverlay />
                <ModalContent
                    bgColor="var(--chain-editor-bg)"
                    h="calc(100% - 7.5rem)"
                    maxW="unset"
                    my={0}
                    w="calc(100% - 7.5rem)"
                >
                    <ModalHeader>Node Documentation</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody
                        position="relative"
                        px={4}
                    >
                        <Heading size="lg">{selectedSchema.name}</Heading>
                        <Heading size="sm">{selectedSchema.category}</Heading>
                        <Text>{selectedSchema.description}</Text>
                        <Heading size="sm">Inputs</Heading>
                        <VStack>
                            {selectedSchema.inputs.map((input) => (
                                <Text>{input.label}</Text>
                            ))}
                        </VStack>
                        <Heading size="sm">Outputs</Heading>
                        <VStack>
                            {selectedSchema.outputs.map((output) => (
                                <Text>{output.label}</Text>
                            ))}
                        </VStack>
                    </ModalBody>

                    <ModalFooter>
                        <HStack>
                            <Button
                                colorScheme="blue"
                                mr={3}
                                onClick={onClose}
                            >
                                Close
                            </Button>
                        </HStack>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        );
    }
);

export const NodeDocumentationButton = memo(() => {
    const { selectedSchemaId, isOpen, openNodeDocumentation, onClose } =
        useContext(NodeDocumentationContext);
    return (
        <>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label="Node Documentation"
                px={2}
                py={1}
            >
                <IconButton
                    aria-label="Node Documentation"
                    icon={<BsFillJournalBookmarkFill />}
                    size="md"
                    variant="outline"
                    onClick={() => {
                        openNodeDocumentation(selectedSchemaId);
                    }}
                >
                    Node Documentation
                </IconButton>
            </Tooltip>
            <NodeDocumentationModal
                isOpen={isOpen}
                selectedSchemaId={selectedSchemaId}
                onClose={onClose}
            />
        </>
    );
});
