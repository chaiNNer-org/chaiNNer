import {
    Box,
    Button,
    Center,
    Code,
    Divider,
    HStack,
    Heading,
    IconButton,
    ListItem,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Text,
    Tooltip,
    UnorderedList,
    VStack,
} from '@chakra-ui/react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { useContext } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { prettyPrintType } from '../../common/types/pretty';
import { BackendContext } from '../contexts/BackendContext';
import { NodeDocumentationContext } from '../contexts/NodeDocumentationContext';
import { getCategoryAccentColor } from '../helpers/accentColors';
import { getNodesByCategory } from '../helpers/nodeSearchFuncs';
import { IconFactory } from './CustomIcons';

interface NodeDocumentationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpen: (schemaId?: SchemaId) => void;
    selectedSchemaId: SchemaId | undefined;
}

export const NodeDocumentationModal = memo(
    ({ isOpen, onClose, selectedSchemaId, onOpen }: NodeDocumentationModalProps) => {
        const { schemata, functionDefinitions, categories } = useContext(BackendContext);

        const schema = schemata.schemata;
        const selectedSchema = schemata.get(selectedSchemaId ?? schema[0].schemaId);
        const selectedFunctionDefinition = functionDefinitions.get(
            selectedSchemaId ?? schema[0].schemaId
        );
        const selectedAccentColor = getCategoryAccentColor(categories, selectedSchema.category);

        const byCategories = useMemo(() => getNodesByCategory(schema), [schema]);

        const selectedElement = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (selectedElement.current) {
                selectedElement.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest',
                });
            }
        }, [isOpen, selectedSchemaId]);

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
                        overflow="hidden"
                        position="relative"
                        px={4}
                    >
                        <HStack w="full">
                            <Box w={64}>
                                <VStack
                                    h="full"
                                    left={0}
                                    maxH="full"
                                    overflowY="scroll"
                                    position="absolute"
                                    spacing={0}
                                    top={0}
                                    w={64}
                                >
                                    {categories.map((category) => {
                                        const categoryNodes = byCategories.get(category.name);
                                        return (
                                            <>
                                                <Center
                                                    borderBottomColor="gray.500"
                                                    borderBottomWidth="1px"
                                                    p={2}
                                                    pt={4}
                                                    w="full"
                                                >
                                                    <HStack>
                                                        <IconFactory
                                                            accentColor={category.color}
                                                            icon={category.icon}
                                                        />
                                                        <Text>{category.name}</Text>
                                                    </HStack>
                                                </Center>
                                                {categoryNodes?.map((node) => {
                                                    const isSelected =
                                                        node.schemaId === selectedSchemaId;
                                                    return (
                                                        <Center
                                                            _hover={{
                                                                backgroundColor: 'var(--bg-700)',
                                                            }}
                                                            backgroundColor={
                                                                isSelected
                                                                    ? 'var(--bg-700)'
                                                                    : 'var(--bg-800)'
                                                            }
                                                            borderBottomColor="gray.500"
                                                            borderBottomWidth="1px"
                                                            borderLeftColor={category.color}
                                                            borderLeftWidth={isSelected ? 8 : 4}
                                                            cursor="pointer"
                                                            p={2}
                                                            ref={
                                                                isSelected
                                                                    ? selectedElement
                                                                    : undefined
                                                            }
                                                            w="full"
                                                            onClick={() => {
                                                                onOpen(node.schemaId);
                                                            }}
                                                        >
                                                            <Text
                                                                cursor="pointer"
                                                                key={node.schemaId}
                                                            >
                                                                {node.name}
                                                            </Text>
                                                        </Center>
                                                    );
                                                })}
                                            </>
                                        );
                                    })}
                                </VStack>
                            </Box>
                            <VStack
                                alignItems="left"
                                divider={<Divider />}
                                pl={8}
                                spacing={2}
                                textAlign="left"
                                w="full"
                            >
                                <Box>
                                    <HStack>
                                        <IconFactory
                                            accentColor={selectedAccentColor}
                                            boxSize={8}
                                            icon={selectedSchema.icon}
                                        />
                                        <Heading size="lg">{selectedSchema.name}</Heading>
                                    </HStack>
                                    {/* <Heading size="sm">{selectedSchema.category}</Heading> */}
                                    <Text>{selectedSchema.description}</Text>
                                </Box>
                                <Box>
                                    <Heading size="sm">Inputs</Heading>
                                    <UnorderedList
                                        alignItems="left"
                                        ml={8}
                                        textAlign="left"
                                        w="full"
                                    >
                                        {selectedSchema.inputs.map((input) => {
                                            const type =
                                                selectedFunctionDefinition?.inputDefaults.get(
                                                    input.id
                                                );
                                            return (
                                                <ListItem key={input.id}>
                                                    <Text>{input.label}</Text>
                                                    {type && <Code>{prettyPrintType(type)}</Code>}
                                                </ListItem>
                                            );
                                        })}
                                    </UnorderedList>
                                </Box>
                                <Box>
                                    <Heading size="sm">Outputs</Heading>
                                    <UnorderedList
                                        alignItems="left"
                                        ml={8}
                                        textAlign="left"
                                        w="full"
                                    >
                                        {selectedSchema.outputs.map((output) => {
                                            const type =
                                                selectedFunctionDefinition?.outputDefaults.get(
                                                    output.id
                                                );

                                            return (
                                                <ListItem key={output.id}>
                                                    <Text>{output.label}</Text>
                                                    {type && <Code>{prettyPrintType(type)}</Code>}
                                                </ListItem>
                                            );
                                        })}
                                    </UnorderedList>
                                </Box>
                            </VStack>
                        </HStack>
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
                onOpen={openNodeDocumentation}
            />
        </>
    );
});
