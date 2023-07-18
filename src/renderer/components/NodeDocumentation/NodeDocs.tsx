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
    Tooltip,
    UnorderedList,
    VStack,
    useMediaQuery,
} from '@chakra-ui/react';
import { memo } from 'react';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useContext } from 'use-context-selector';
import { Condition, Input, NodeSchema, Output } from '../../../common/common-types';
import { isTautology } from '../../../common/nodes/condition';
import { getInputCondition } from '../../../common/nodes/inputCondition';
import { explain } from '../../../common/types/explain';
import { FunctionDefinition } from '../../../common/types/function';
import { prettyPrintType } from '../../../common/types/pretty';
import { withoutNull } from '../../../common/types/util';
import { capitalize, isAutoInput } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { getCategoryAccentColor, getTypeAccentColors } from '../../helpers/accentColors';
import { IconFactory } from '../CustomIcons';
import { TypeTag } from '../TypeTag';
import { ConditionExplanation } from './ConditionExplanation';
import { docsMarkdown } from './docsMarkdown';
import { DropDownOptions } from './DropDownOptions';
import { NodeExample } from './NodeExample';
import { SchemaLink } from './SchemaLink';

interface TypeViewProps {
    type: Type;
}
const TypeView = memo(({ type }: TypeViewProps) => {
    const tooltipText = explain(type, { detailed: true });

    return (
        <Tooltip
            borderRadius={8}
            label={tooltipText && capitalize(tooltipText)}
            px={2}
            py={1}
        >
            <Code
                display="inline"
                userSelect="text"
                whiteSpace="pre-line"
            >
                {prettyPrintType(type)}
            </Code>
        </Tooltip>
    );
});

interface InputOutputItemProps {
    schema: NodeSchema;
    item: Input | Output;
    type: Type;
    condition?: Condition;
}

const InputOutputItem = memo(({ type, item, condition, schema }: InputOutputItemProps) => {
    const isOptional = 'optional' in item && item.optional;
    if (isOptional) {
        // eslint-disable-next-line no-param-reassign
        type = withoutNull(type);
    }

    const handleColors = getTypeAccentColors(type);

    const isFileInput = item.kind === 'file';
    const supportedFileTypes = isFileInput ? item.filetypes : [];
    const isPrimaryInput = isFileInput && item.primaryInput;

    const isTextInput = item.kind === 'text';
    const isDropdownInput = item.kind === 'dropdown';

    return (
        <ListItem my={2}>
            <HStack mb={1}>
                <Text
                    fontWeight="bold"
                    userSelect="text"
                >
                    {item.label}
                </Text>
                {isOptional && (
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
                {item.hasHandle &&
                    handleColors.map((color) => (
                        <Box
                            bgColor={color}
                            borderRadius="100%"
                            h="0.5rem"
                            key={color}
                            w="0.5rem"
                        />
                    ))}
            </HStack>
            <VStack
                alignItems="start"
                spacing={1}
                w="full"
            >
                {item.description && (
                    <ReactMarkdown components={docsMarkdown}>{item.description}</ReactMarkdown>
                )}

                {isFileInput && supportedFileTypes.length > 0 && (
                    <Text
                        fontSize="md"
                        userSelect="text"
                    >
                        Supported file types:
                        {supportedFileTypes.map((fileType) => (
                            <TypeTag
                                fontSize="small"
                                height="auto"
                                key={fileType}
                                mt="-0.2rem"
                                verticalAlign="middle"
                            >
                                {fileType}
                            </TypeTag>
                        ))}
                    </Text>
                )}

                {isFileInput && isPrimaryInput && (
                    <Text
                        fontSize="md"
                        userSelect="text"
                    >
                        This input is the primary input for its supported file types. This means
                        that you can drag and drop supported files into chaiNNer, and it will create
                        a node with this input filled in automatically.
                    </Text>
                )}

                {condition && !isTautology(condition) && (
                    <Text
                        fontSize="md"
                        userSelect="text"
                    >
                        <Text
                            as="i"
                            pr={1}
                        >
                            Condition:
                        </Text>
                        <ConditionExplanation
                            condition={condition}
                            schema={schema}
                        />
                    </Text>
                )}

                {isTextInput && (
                    <Text
                        fontSize="md"
                        userSelect="text"
                    >
                        {`A ${item.multiline ? 'multi-line ' : ''}string ${
                            item.maxLength
                                ? `between ${item.minLength ?? 0} and ${item.maxLength}`
                                : `at least ${item.minLength ?? 0}`
                        } character${
                            (item.maxLength === null || item.maxLength === undefined) &&
                            item.minLength === 1
                                ? ''
                                : 's'
                        } long.`}
                    </Text>
                )}

                {isDropdownInput && (
                    <Text
                        fontSize="md"
                        userSelect="text"
                    >
                        <Text
                            as="i"
                            pr={1}
                        >
                            Options:
                        </Text>
                        <DropDownOptions options={item.options} />
                    </Text>
                )}

                {!isDropdownInput && (
                    <Box whiteSpace="nowrap">
                        <Text
                            as="i"
                            pr={1}
                        >
                            Type:
                        </Text>
                        <TypeView type={type} />
                    </Box>
                )}
            </VStack>
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
                <ReactMarkdown components={docsMarkdown}>{schema.description}</ReactMarkdown>
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
                                    condition={getInputCondition(schema, input.id)}
                                    item={input}
                                    key={input.id}
                                    schema={schema}
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
                                    item={output}
                                    key={output.id}
                                    schema={schema}
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

    const selectedAccentColor = getCategoryAccentColor(categories, selectedSchema.category);

    const [isLargerThan1200] = useMediaQuery('(min-width: 1200px)');

    const nodeDocsToShow = [
        selectedSchema,
        ...(selectedSchema.defaultNodes?.map((n) => schemata.get(n.schemaId)) ?? []),
    ];

    return (
        <Box
            h="full"
            position="relative"
            w="full"
        >
            <Box w="full">
                <Box
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
                        {nodeDocsToShow.map((nodeSchema) => {
                            const nodeFunctionDefinition = functionDefinitions.get(
                                nodeSchema.schemaId
                            );
                            return (
                                <Flex
                                    direction={isLargerThan1200 ? 'row' : 'column'}
                                    gap={4}
                                >
                                    <SingleNodeInfo
                                        accentColor={selectedAccentColor}
                                        functionDefinition={nodeFunctionDefinition}
                                        key={nodeSchema.schemaId}
                                        schema={nodeSchema}
                                    />
                                    <Center
                                        h="full"
                                        position="relative"
                                        verticalAlign="top"
                                    >
                                        <Box
                                            maxW="fit-content"
                                            mr={6}
                                            position="relative"
                                            w="auto"
                                        >
                                            <NodeExample
                                                accentColor={selectedAccentColor}
                                                key={nodeSchema.schemaId}
                                                selectedSchema={nodeSchema}
                                            />
                                        </Box>
                                    </Center>
                                </Flex>
                            );
                        })}
                    </VStack>
                </Box>
            </Box>
        </Box>
    );
});
