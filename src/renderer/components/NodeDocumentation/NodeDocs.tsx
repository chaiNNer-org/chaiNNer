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
import { useTranslation } from 'react-i18next';
import { useContext } from 'use-context-selector';
import { Condition, Input, NodeSchema, Output, TextInput } from '../../../common/common-types';
import { isTautology } from '../../../common/nodes/condition';
import { getInputCondition } from '../../../common/nodes/inputCondition';
import { explain } from '../../../common/types/explain';
import { FunctionDefinition } from '../../../common/types/function';
import { prettyPrintType } from '../../../common/types/pretty';
import { withoutError, withoutNull } from '../../../common/types/util';
import { capitalize, isAutoInput } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { getCategoryAccentColor } from '../../helpers/accentColors';
import { useTypeColor } from '../../hooks/useTypeColor';
import { IconFactory } from '../CustomIcons';
import { Markdown } from '../Markdown';
import { TypeTag } from '../TypeTag';
import { ConditionExplanation } from './ConditionExplanation';
import { DropDownOptions } from './DropDownOptions';
import { NoHighlighting, SupportHighlighting } from './HighlightContainer';
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
                {prettyPrintType(type, { omitDefaultFields: true })}
            </Code>
        </Tooltip>
    );
});

const getTextLength = (input: TextInput): string => {
    const chars = (count: number): string => `${count} ${count === 1 ? 'character' : 'characters'}`;

    const minLength = input.minLength ?? 0;
    const { maxLength } = input;

    let range;
    if (maxLength) {
        if (maxLength === minLength) {
            range = `exactly ${chars(maxLength)}`;
        } else {
            range = `between ${minLength} and ${chars(maxLength)}`;
        }
    } else {
        range = `at least ${chars(minLength)}`;
    }

    return `A ${input.multiline ? 'multi-line ' : ''}string ${range} long.`;
};

interface InputOutputItemProps {
    schema: NodeSchema;
    type: Type;
    condition?: Condition;
}
interface InputItemProps extends InputOutputItemProps {
    schema: NodeSchema;
    kind: 'input';
    item: Input;
    type: Type;
    condition?: Condition;
}
interface OutputItemProps extends InputOutputItemProps {
    schema: NodeSchema;
    kind: 'output';
    item: Output;
    type: Type;
    condition?: Condition;
}

const InputOutputItem = memo(
    ({ type, kind, item, condition, schema }: InputItemProps | OutputItemProps) => {
        const { t } = useTranslation();
        const isOptional = 'optional' in item && item.optional;
        if (isOptional) {
            // eslint-disable-next-line no-param-reassign
            type = withoutNull(type);
        }

        const isIterated =
            kind === 'input'
                ? schema.iteratorInputs.some((i) => i.inputs.includes(item.id))
                : schema.iteratorOutputs.some((i) => i.outputs.includes(item.id));

        const handleColors = useTypeColor(type);

        const isFileInput = item.kind === 'file';
        const supportedFileTypes = isFileInput ? item.filetypes : [];
        const isPrimaryInput = isFileInput && item.primaryInput;

        const isTextInput = item.kind === 'text';
        const isDropdownInput = item.kind === 'dropdown';

        return (
            <SupportHighlighting>
                <ListItem
                    mb={4}
                    mt={2}
                >
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
                                {t('nodeDocumentation.nodeDocs.optional')}
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
                        {isIterated && <Text>{t('nodeDocumentation.nodeDocs.sequenced')}</Text>}
                    </HStack>
                    <VStack
                        alignItems="start"
                        spacing={1}
                        w="full"
                    >
                        {item.description && (
                            <NoHighlighting>
                                <Markdown>{item.description}</Markdown>
                            </NoHighlighting>
                        )}

                        {isFileInput && supportedFileTypes.length > 0 && (
                            <Text
                                fontSize="md"
                                userSelect="text"
                            >
                                {t('nodeDocumentation.nodeDocs.supportedFileTypes')}
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
                                {t('nodeDocumentation.nodeDocs.primaryInputDescription')}
                            </Text>
                        )}

                        {condition && !isTautology(condition) && (
                            <ConditionExplanation
                                condition={condition}
                                schema={schema}
                            />
                        )}

                        {isTextInput &&
                            !((item.minLength ?? 0) === 0 && item.maxLength == null) && (
                                <Text
                                    fontSize="md"
                                    userSelect="text"
                                >
                                    {getTextLength(item)}
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
                                    {t('nodeDocumentation.nodeDocs.options')}
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
                                    {t('nodeDocumentation.nodeDocs.type')}
                                </Text>
                                <TypeView type={withoutError(type)} />
                            </Box>
                        )}
                    </VStack>
                </ListItem>
            </SupportHighlighting>
        );
    }
);

interface NodeInfoProps {
    schema: NodeSchema;
    accentColor: string;
    functionDefinition?: FunctionDefinition;
}
const SingleNodeInfo = memo(({ schema, accentColor, functionDefinition }: NodeInfoProps) => {
    const { t } = useTranslation();
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
                        <SupportHighlighting>{schema.name}</SupportHighlighting>
                    </Heading>
                </HStack>
                <Markdown>{schema.description}</Markdown>
            </Box>
            <Box position="relative">
                <Heading
                    mb={1}
                    size="sm"
                    userSelect="text"
                >
                    {t('nodeDocumentation.nodeDocs.inputs')}
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
                                    kind="input"
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
                    <Text>{t('nodeDocumentation.nodeDocs.noInputs')}</Text>
                )}
            </Box>
            <Box position="relative">
                <Heading
                    mb={1}
                    size="sm"
                    userSelect="text"
                >
                    {t('nodeDocumentation.nodeDocs.outputs')}
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
                                    kind="output"
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
                    <Text>{t('nodeDocumentation.nodeDocs.noOutputs')}</Text>
                )}
            </Box>
            {seeAlso.length > 0 && (
                <Box position="relative">
                    <Heading
                        mb={1}
                        size="sm"
                        userSelect="text"
                    >
                        {t('nodeDocumentation.nodeDocs.seeAlso')}
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

interface NodeDocsProps {
    schema: NodeSchema;
}
export const NodeDocs = memo(({ schema }: NodeDocsProps) => {
    const { functionDefinitions, categories } = useContext(BackendContext);

    const selectedAccentColor = getCategoryAccentColor(categories, schema.category);

    const [isLargerThan1200] = useMediaQuery('(min-width: 1200px)');

    const nodeFunctionDefinition = functionDefinitions.get(schema.schemaId);

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
                        <Flex
                            direction={isLargerThan1200 ? 'row' : 'column'}
                            gap={4}
                        >
                            <SingleNodeInfo
                                accentColor={selectedAccentColor}
                                functionDefinition={nodeFunctionDefinition}
                                schema={schema}
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
                                    <NodeExample selectedSchema={schema} />
                                </Box>
                            </Center>
                        </Flex>
                    </VStack>
                </Box>
            </Box>
        </Box>
    );
});
