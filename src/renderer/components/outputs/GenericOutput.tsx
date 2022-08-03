import { Center, Flex, Spacer, Text } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { NamedExpression, NamedExpressionField } from '../../../common/types/expression';
import { StringLiteralType } from '../../../common/types/types';
import { isStartingNode } from '../../../common/util';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTags } from '../TypeTag';
import { OutputProps } from './props';

export const GenericOutput = memo(
    ({ label, id, outputId, schemaId, useOutputData, kind }: OutputProps) => {
        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(id)?.outputs.get(outputId)
        );

        const { setManualOutputType, schemata } = useContext(GlobalContext);

        const schema = schemata.get(schemaId);

        const [value] = useOutputData(outputId);

        useEffect(() => {
            if (isStartingNode(schema)) {
                if (value !== undefined) {
                    if (kind === 'text') {
                        setManualOutputType(id, outputId, new StringLiteralType(value as string));
                    } else if (kind === 'directory') {
                        setManualOutputType(
                            id,
                            outputId,
                            new NamedExpression('Directory', [
                                new NamedExpressionField(
                                    'path',
                                    new StringLiteralType(value as string)
                                ),
                            ])
                        );
                    }
                } else {
                    setManualOutputType(id, outputId, undefined);
                }
            }
        }, [id, schemaId, value]);

        return (
            <Flex
                h="full"
                minH="2rem"
                verticalAlign="middle"
                w="full"
            >
                <Spacer />
                {type && (
                    <Center
                        h="2rem"
                        verticalAlign="middle"
                    >
                        <TypeTags type={type} />
                    </Center>
                )}
                <Text
                    h="full"
                    lineHeight="2rem"
                    marginInlineEnd="0.5rem"
                    ml={1}
                    textAlign="right"
                >
                    {label}
                </Text>
            </Flex>
        );
    }
);
