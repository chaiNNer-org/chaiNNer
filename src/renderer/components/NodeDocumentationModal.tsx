import {
    Box,
    Button,
    Center,
    Code,
    Divider,
    Flex,
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
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import { PropsWithChildren, memo, useEffect, useMemo, useRef } from 'react';
import { BsFillJournalBookmarkFill } from 'react-icons/bs';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useContext } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { DisabledStatus } from '../../common/nodes/disabled';
import { prettyPrintType } from '../../common/types/pretty';
import { BackendContext } from '../contexts/BackendContext';
import { NodeDocumentationContext } from '../contexts/NodeDocumentationContext';
import { getCategoryAccentColor } from '../helpers/accentColors';
import { getNodesByCategory } from '../helpers/nodeSearchFuncs';
import { IconFactory } from './CustomIcons';
import { NodeBody } from './node/NodeBody';
import { NodeFooter } from './node/NodeFooter/NodeFooter';
import { NodeHeader } from './node/NodeHeader';

interface NodeDocumentationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpen: (schemaId?: SchemaId) => void;
    selectedSchemaId: SchemaId | undefined;
}

const customMarkdownTheme = {
    p: (props: PropsWithChildren<unknown>) => {
        const { children } = props;
        return <Text mb={0}>{children}</Text>;
    },
};

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

                                        if (!categoryNodes || categoryNodes.length === 0) {
                                            return null;
                                        }

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
                                                {categoryNodes.map((node) => {
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
                            <Box
                                h="full"
                                pl={8}
                                w="full"
                            >
                                <Flex
                                    overflowY="scroll"
                                    position="relative"
                                >
                                    <VStack
                                        alignItems="left"
                                        display="block"
                                        divider={<Divider />}
                                        h="full"
                                        maxH="full"
                                        spacing={2}
                                        textAlign="left"
                                        w="full"
                                    >
                                        <Box>
                                            <HStack>
                                                <IconFactory
                                                    accentColor={selectedAccentColor}
                                                    boxSize={6}
                                                    icon={selectedSchema.icon}
                                                />
                                                <Heading size="lg">{selectedSchema.name}</Heading>
                                            </HStack>
                                            <ReactMarkdown
                                                components={ChakraUIRenderer(customMarkdownTheme)}
                                            >
                                                {selectedSchema.description}
                                            </ReactMarkdown>
                                        </Box>
                                        <Box position="relative">
                                            <Heading
                                                mb={1}
                                                size="sm"
                                            >
                                                Inputs
                                            </Heading>
                                            {selectedSchema.outputs.length > 0 ? (
                                                <UnorderedList
                                                    alignItems="left"
                                                    ml={0}
                                                    pl={8}
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
                                                                <Text fontWeight="bold">
                                                                    {input.label}
                                                                </Text>
                                                                {input.description && (
                                                                    <ReactMarkdown
                                                                        components={ChakraUIRenderer(
                                                                            customMarkdownTheme
                                                                        )}
                                                                    >
                                                                        {input.description}
                                                                    </ReactMarkdown>
                                                                )}
                                                                {type && (
                                                                    <Code>
                                                                        {prettyPrintType(type)}
                                                                    </Code>
                                                                )}
                                                            </ListItem>
                                                        );
                                                    })}
                                                </UnorderedList>
                                            ) : (
                                                <Text>This node has no inputs.</Text>
                                            )}
                                        </Box>
                                        <Box position="relative">
                                            <Heading
                                                mb={1}
                                                size="sm"
                                            >
                                                Outputs
                                            </Heading>
                                            {selectedSchema.outputs.length > 0 ? (
                                                <UnorderedList
                                                    alignItems="left"
                                                    ml={0}
                                                    pl={8}
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
                                                                <Text fontWeight="bold">
                                                                    {output.label}
                                                                </Text>
                                                                {output.description && (
                                                                    <ReactMarkdown
                                                                        components={ChakraUIRenderer(
                                                                            customMarkdownTheme
                                                                        )}
                                                                    >
                                                                        {output.description}
                                                                    </ReactMarkdown>
                                                                )}
                                                                {type && (
                                                                    <Code>
                                                                        {prettyPrintType(type)}
                                                                    </Code>
                                                                )}
                                                            </ListItem>
                                                        );
                                                    })}
                                                </UnorderedList>
                                            ) : (
                                                <Text>This node has no outputs.</Text>
                                            )}
                                        </Box>
                                    </VStack>
                                    <Box
                                        pl={8}
                                        position="relative"
                                    >
                                        <Center
                                            pointerEvents="none"
                                            w="auto"
                                        >
                                            <Center
                                                bg="var(--node-bg-color)"
                                                borderColor="var(--node-border-color)"
                                                borderRadius="lg"
                                                borderWidth="0.5px"
                                                boxShadow="lg"
                                                minWidth="240px"
                                                overflow="hidden"
                                                transition="0.15s ease-in-out"
                                            >
                                                <VStack
                                                    spacing={0}
                                                    w="full"
                                                >
                                                    <VStack
                                                        spacing={0}
                                                        w="full"
                                                    >
                                                        <NodeHeader
                                                            accentColor={selectedAccentColor}
                                                            disabledStatus={DisabledStatus.Enabled}
                                                            icon={selectedSchema.icon}
                                                            name={selectedSchema.name}
                                                            parentNode={undefined}
                                                            selected={false}
                                                        />
                                                        <NodeBody
                                                            animated={false}
                                                            id={selectedSchema.schemaId}
                                                            inputData={{}}
                                                            isLocked={false}
                                                            schema={selectedSchema}
                                                        />
                                                    </VStack>
                                                    <NodeFooter
                                                        animated={false}
                                                        id={selectedSchema.schemaId}
                                                        validity={{ isValid: true }}
                                                    />
                                                </VStack>
                                            </Center>
                                        </Center>
                                    </Box>
                                </Flex>
                            </Box>
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
