import { NeverType, Type } from '@chainner/navi';
import {
    Box,
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
import { memo } from 'react';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useContext } from 'use-context-selector';
import { NodeSchema } from '../../../common/common-types';
import { FunctionDefinition } from '../../../common/types/function';
import { prettyPrintType } from '../../../common/types/pretty';
import { withoutNull } from '../../../common/types/util';
import { isAutoInput } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { NodeDocumentationContext } from '../../contexts/NodeDocumentationContext';
import { getCategoryAccentColor, getTypeAccentColors } from '../../helpers/accentColors';
import { IconFactory } from '../CustomIcons';
import { TypeTag } from '../TypeTag';
import { docsMarkdown } from './docsMarkdown';
import { NodeExample } from './NodeExample';
import { SchemaLink } from './SchemaLink';

interface InputOutputItemProps {
    label: string;
    description?: string | null;
    type: Type;
    optional: boolean;
    hasHandle?: boolean;
}
const InputOutputItem = memo(
    ({ label, description, type, optional, hasHandle = true }: InputOutputItemProps) => {
        if (optional) {
            // eslint-disable-next-line no-param-reassign
            type = withoutNull(type);
        }

        const handleColors = getTypeAccentColors(type);

        return (
            <ListItem my={2}>
                <HStack>
                    <Text
                        fontWeight="bold"
                        userSelect="text"
                    >
                        {label}
                    </Text>
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
                    {hasHandle &&
                        handleColors.map((color) => (
                            <Box
                                bgColor={color}
                                borderRadius="100%"
                                h="0.5rem"
                                w="0.5rem"
                            />
                        ))}
                </HStack>

                {description && (
                    <ReactMarkdown components={docsMarkdown}>{description}</ReactMarkdown>
                )}
                <Code userSelect="text">{prettyPrintType(type)}</Code>
            </ListItem>
        );
    }
);

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
                                    description={input.description}
                                    hasHandle={input.hasHandle}
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
                            <NodeExample
                                accentColor={selectedAccentColor}
                                selectedSchema={selectedSchema}
                            />
                            {hasIteratorHelperNodes &&
                                selectedSchema.defaultNodes.map((defaultNode) => {
                                    const nodeSchema = schemata.get(defaultNode.schemaId);
                                    return (
                                        <NodeExample
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
