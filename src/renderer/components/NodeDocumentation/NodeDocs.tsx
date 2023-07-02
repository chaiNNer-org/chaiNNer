import { NeverType, Type } from '@chainner/navi';
import {
    Box,
    Center,
    Code,
    Divider,
    Flex,
    HStack,
    Heading,
    ListItem,
    Text,
    UnorderedList,
    VStack,
    useMediaQuery,
} from '@chakra-ui/react';
import ChakraUIRenderer from 'chakra-ui-markdown-renderer';
import { memo, useCallback, useState } from 'react';
import { Components } from 'react-markdown';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useContext } from 'use-context-selector';
import { InputData, InputId, InputValue, NodeSchema, SchemaId } from '../../../common/common-types';
import { DisabledStatus } from '../../../common/nodes/disabled';
import { FunctionDefinition } from '../../../common/types/function';
import { prettyPrintType } from '../../../common/types/pretty';
import { withoutNull } from '../../../common/types/util';
import { isAutoInput } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { getCategoryAccentColor } from '../../helpers/accentColors';
import { IconFactory } from '../CustomIcons';
import { NodeBody } from '../node/NodeBody';
import { NodeFooter } from '../node/NodeFooter/NodeFooter';
import { NodeHeader } from '../node/NodeHeader';
import { TypeTag } from '../TypeTag';

const SchemaLink = memo(({ schema }: { schema: NodeSchema }) => {
    const { openNodeDocumentation } = useContext(NodeDocumentationContext);

    return (
        <Text
            _hover={{
                textDecoration: 'underline',
            }}
            as="i"
            backgroundColor="var(--bg-700)"
            borderRadius={4}
            color="var(--link-color)"
            cursor="pointer"
            fontWeight="bold"
            px={2}
            py={1}
            userSelect="text"
            onClick={() => openNodeDocumentation(schema.schemaId)}
        >
            {schema.name}
        </Text>
    );
});

const customMarkdownTheme: Components = {
    p: ({ children }) => {
        return (
            <Text
                my={2}
                userSelect="text"
            >
                {children}
            </Text>
        );
    },
    // eslint-disable-next-line react/prop-types
    code: memo(({ inline, className, children, ...props }) => {
        const { schemata } = useContext(BackendContext);

        // const language = /language-([\w-]+)/.exec(className || '')?.[1];
        const text = String(children);

        if (inline && schemata.has(text as SchemaId)) {
            return <SchemaLink schema={schemata.get(text as SchemaId)} />;
        }

        return (
            <Code
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...props}
                className={className}
            >
                {children}
            </Code>
        );
    }),
};

interface NodeExampleProps {
    accentColor: string;
    selectedSchema: NodeSchema;
}
const FakeNodeExample = memo(({ accentColor, selectedSchema }: NodeExampleProps) => {
    const [state, setState] = useState<{ inputData: InputData; schema: NodeSchema }>({
        inputData: {},
        schema: selectedSchema,
    });

    const setInputValue = useCallback(
        (inputId: InputId, value: InputValue): void => {
            setState((prev) => {
                const inputData = prev.schema === selectedSchema ? prev.inputData : {};
                return {
                    inputData: {
                        ...inputData,
                        [inputId]: value,
                    },
                    schema: selectedSchema,
                };
            });
        },
        [selectedSchema]
    );

    const inputData = state.schema === selectedSchema ? state.inputData : {};
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
                            id="<fake node id>"
                            inputData={inputData}
                            isLocked={false}
                            schema={selectedSchema}
                            setInputValue={setInputValue}
                        />
                    </VStack>
                    <NodeFooter
                        animated={false}
                        id="<fake node id>"
                        validity={{ isValid: true }}
                    />
                </VStack>
            </Center>
        </Center>
    );
});

interface InputOutputItemProps {
    label: string;
    description?: string | null;
    type: Type;
    optional: boolean;
}
const InputOutputItem = memo(({ label, description, type, optional }: InputOutputItemProps) => {
    if (optional) {
        // eslint-disable-next-line no-param-reassign
        type = withoutNull(type);
    }

    return (
        <ListItem my={2}>
            <Text
                fontWeight="bold"
                userSelect="text"
            >
                {label}
                {optional && (
                    <TypeTag
                        isOptional
                        fontSize="small"
                        height="auto"
                        mt="-0.2rem"
                        verticalAlign="middle"
                    >
                        optional
                    </TypeTag>
                )}
            </Text>
            {description && (
                <ReactMarkdown components={ChakraUIRenderer(customMarkdownTheme)}>
                    {description}
                </ReactMarkdown>
            )}
            <Code userSelect="text">{prettyPrintType(type)}</Code>
        </ListItem>
    );
});

interface NodeInfoProps {
    schema: NodeSchema;
    accentColor: string;
    functionDefinition?: FunctionDefinition;
}
const SingleNodeInfo = memo(({ schema, accentColor, functionDefinition }: NodeInfoProps) => {
    const { schemata } = useContext(BackendContext);

    const inputs = schema.inputs.filter((i) => !isAutoInput(i));
    const outputs = schema.outputs.filter((o) => o.hasHandle);

    const seeAlso = schema.seeAlso
        .filter((schemaId) => schemata.has(schemaId))
        .map((schemaId) => schemata.get(schemaId));

    return (
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
                        accentColor={accentColor}
                        boxSize={6}
                        icon={schema.icon}
                    />
                    <Heading
                        size="lg"
                        userSelect="text"
                    >
                        {schema.name}
                    </Heading>
                </HStack>
                <ReactMarkdown components={ChakraUIRenderer(customMarkdownTheme)}>
                    {schema.description}
                </ReactMarkdown>
            </Box>
            <Box position="relative">
                <Heading
                    mb={1}
                    size="sm"
                    userSelect="text"
                >
                    Inputs
                </Heading>
                {inputs.length > 0 ? (
                    <UnorderedList
                        alignItems="left"
                        ml={0}
                        pl={8}
                        textAlign="left"
                        userSelect="text"
                        w="full"
                    >
                        {inputs.map((input) => {
                            return (
                                <InputOutputItem
                                    description={input.description}
                                    key={input.id}
                                    label={input.label}
                                    optional={input.optional}
                                    type={
                                        functionDefinition?.inputDefaults.get(input.id) ??
                                        NeverType.instance
                                    }
                                />
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
                    userSelect="text"
                >
                    Outputs
                </Heading>
                {outputs.length > 0 ? (
                    <UnorderedList
                        alignItems="left"
                        ml={0}
                        pl={8}
                        textAlign="left"
                        w="full"
                    >
                        {outputs.map((output) => {
                            return (
                                <InputOutputItem
                                    description={output.description}
                                    key={output.id}
                                    label={output.label}
                                    optional={false}
                                    type={
                                        functionDefinition?.outputDefaults.get(output.id) ??
                                        NeverType.instance
                                    }
                                />
                            );
                        })}
                    </UnorderedList>
                ) : (
                    <Text>This node has no outputs.</Text>
                )}
            </Box>
            {seeAlso.length > 0 && (
                <Box position="relative">
                    <Heading
                        mb={1}
                        size="sm"
                        userSelect="text"
                    >
                        See also
                    </Heading>
                    <UnorderedList
                        alignItems="left"
                        ml={0}
                        pl={8}
                        textAlign="left"
                        w="full"
                    >
                        {seeAlso.map((also) => {
                            return (
                                <ListItem
                                    key={also.schemaId}
                                    my={2}
                                >
                                    <SchemaLink schema={also} />
                                </ListItem>
                            );
                        })}
                    </UnorderedList>
                </Box>
            )}
        </VStack>
    );
});

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

    const hasIteratorHelperNodes =
        selectedSchema.defaultNodes && selectedSchema.defaultNodes.length > 0;

    return (
        <Box
            h="full"
            position="relative"
            w="full"
        >
            <Box w="full">
                <Flex
                    direction={isLargerThan1200 ? 'row' : 'column'}
                    gap={2}
                    left={0}
                    maxH="full"
                    overflowY="scroll"
                    position="absolute"
                    top={0}
                    w="full"
                >
                    <VStack
                        alignItems="left"
                        display="block"
                        divider={<Divider />}
                        h="full"
                        maxH="full"
                        spacing={4}
                        textAlign="left"
                        w="full"
                    >
                        <SingleNodeInfo
                            accentColor={selectedAccentColor}
                            functionDefinition={selectedFunctionDefinition}
                            schema={selectedSchema}
                        />
                        {hasIteratorHelperNodes &&
                            selectedSchema.defaultNodes.map((defaultNode) => {
                                const nodeSchema = schemata.get(defaultNode.schemaId);
                                const nodeFunctionDefinition = functionDefinitions.get(
                                    defaultNode.schemaId
                                );
                                return (
                                    <SingleNodeInfo
                                        accentColor={selectedAccentColor}
                                        functionDefinition={nodeFunctionDefinition}
                                        key={defaultNode.schemaId}
                                        schema={nodeSchema}
                                    />
                                );
                            })}
                    </VStack>
                    <Box
                        h="full"
                        position="relative"
                    >
                        <VStack position="relative">
                            <FakeNodeExample
                                accentColor={selectedAccentColor}
                                selectedSchema={selectedSchema}
                            />
                            {hasIteratorHelperNodes &&
                                selectedSchema.defaultNodes.map((defaultNode) => {
                                    const nodeSchema = schemata.get(defaultNode.schemaId);
                                    return (
                                        <FakeNodeExample
                                            accentColor={selectedAccentColor}
                                            key={defaultNode.schemaId}
                                            selectedSchema={nodeSchema}
                                        />
                                    );
                                })}
                        </VStack>
                    </Box>
                </Flex>
            </Box>
        </Box>
    );
});
