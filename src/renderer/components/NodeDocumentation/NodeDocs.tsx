import {
    Box,
    Center,
    Code,
    Divider,
    Flex,
    HStack,
    Heading,
    Link,
    ListItem,
    Text,
    UnorderedList,
    VStack,
    useMediaQuery,
} from '@chakra-ui/react';
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import { PropsWithChildren, memo } from 'react';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useContext } from 'use-context-selector';
import { NodeSchema, SchemaId } from '../../../common/common-types';
import { DisabledStatus } from '../../../common/nodes/disabled';
import { prettyPrintType } from '../../../common/types/pretty';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { getCategoryAccentColor } from '../../helpers/accentColors';
import { IconFactory } from '../CustomIcons';
import { NodeBody } from '../node/NodeBody';
import { NodeFooter } from '../node/NodeFooter/NodeFooter';
import { NodeHeader } from '../node/NodeHeader';

const customMarkdownTheme = {
    p: (props: PropsWithChildren<unknown>) => {
        const { children } = props;
        return (
            <Text
                mb={0}
                userSelect="text"
            >
                {children}
            </Text>
        );
    },
    // If I don't give this a type of unknown, ReactMarkdown yells at me
    // Just trust me, this works
    a: memo((props: PropsWithChildren<unknown>) => {
        const { children, href } = props as PropsWithChildren<{ href: string }>;

        const { schemata } = useContext(BackendContext);
        const { openNodeDocumentation } = useContext(NodeDocumentationContext);

        const isInternalNodeLink = href.startsWith('#');
        const linkedSchemaId = href.substring(1);

        if (isInternalNodeLink) {
            const nodeSchema = schemata.get(linkedSchemaId as SchemaId);
            if (nodeSchema.schemaId !== '') {
                return (
                    <Text
                        _hover={{
                            textDecoration: 'underline',
                        }}
                        as="i"
                        backgroundColor="var(--bg-700)"
                        borderRadius={4}
                        color="blue.500"
                        cursor="pointer"
                        fontWeight="bold"
                        px={2}
                        py={1}
                        userSelect="text"
                        onClick={() => openNodeDocumentation(nodeSchema.schemaId)}
                    >
                        {nodeSchema.name}
                    </Text>
                );
            }
        }

        return (
            <Link
                isExternal
                color="blue.500"
                href={href.toString()}
                userSelect="text"
            >
                {children}
            </Link>
        );
    }),
};

const FakeNodeExample = memo(
    ({ accentColor, selectedSchema }: { accentColor: string; selectedSchema: NodeSchema }) => {
        return (
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
                                accentColor={accentColor}
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
        );
    }
);

export const NodeDocs = memo(() => {
    const { schemata, functionDefinitions, categories } = useContext(BackendContext);
    const { selectedSchemaId } = useContext(NodeDocumentationContext);

    const schema = schemata.schemata;
    const selectedSchema = schemata.get(selectedSchemaId ?? schema[0].schemaId);
    const selectedFunctionDefinition = functionDefinitions.get(
        selectedSchemaId ?? schema[0].schemaId
    );
    const selectedAccentColor = getCategoryAccentColor(categories, selectedSchema.category);

    const [isLargerThan1200] = useMediaQuery('(min-width: 1200px)');

    return (
        <>
            <Box
                h="full"
                position="relative"
                w="full"
            >
                <Box w="full">
                    <Flex
                        direction="column"
                        gap={2}
                        left={0}
                        maxH="full"
                        overflowY="scroll"
                        position="absolute"
                        top={0}
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
                            <Box userSelect="text">
                                <HStack>
                                    <IconFactory
                                        accentColor={selectedAccentColor}
                                        boxSize={6}
                                        icon={selectedSchema.icon}
                                    />
                                    <Heading
                                        size="lg"
                                        userSelect="text"
                                    >
                                        {selectedSchema.name}
                                    </Heading>
                                </HStack>
                                <ReactMarkdown components={ChakraUIRenderer(customMarkdownTheme)}>
                                    {selectedSchema.description}
                                </ReactMarkdown>
                            </Box>

                            <Box position="relative">
                                <Heading
                                    mb={1}
                                    size="sm"
                                    userSelect="text"
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
                                                    <Text
                                                        fontWeight="bold"
                                                        userSelect="text"
                                                    >
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
                                                        <Code userSelect="text">
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
                        {!isLargerThan1200 && (
                            <Box
                                h="full"
                                position="relative"
                            >
                                <Box position="relative">
                                    <FakeNodeExample
                                        accentColor={selectedAccentColor}
                                        selectedSchema={selectedSchema}
                                    />
                                </Box>
                            </Box>
                        )}
                    </Flex>
                </Box>
            </Box>
            {isLargerThan1200 && (
                <Box
                    h="full"
                    position="relative"
                >
                    <Box position="relative">
                        <FakeNodeExample
                            accentColor={selectedAccentColor}
                            selectedSchema={selectedSchema}
                        />
                    </Box>
                </Box>
            )}
        </>
    );
});
