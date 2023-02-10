import { NamedExpression, NamedExpressionField, literal } from '@chainner/navi';
import { Center, Flex, Spacer, Text } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { isStartingNode } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTags } from '../TypeTag';
import { OutputProps } from './props';

interface OnnxModelData {
    arch: string;
    subType: string;
}

export const OnnxModelOutput = memo(
    ({ label, id, outputId, useOutputData, schemaId }: OutputProps) => {
        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(id)?.outputs.get(outputId)
        );

        const { current } = useOutputData<OnnxModelData>(outputId);

        const { setManualOutputType } = useContext(GlobalContext);
        const { schemata } = useContext(BackendContext);

        const schema = schemata.get(schemaId);

        useEffect(() => {
            if (isStartingNode(schema)) {
                if (current) {
                    setManualOutputType(
                        id,
                        outputId,
                        new NamedExpression('OnnxModel', [
                            new NamedExpressionField('arch', literal(current.arch)),
                            new NamedExpressionField('subType', literal(current.subType)),
                        ])
                    );
                } else {
                    setManualOutputType(id, outputId, undefined);
                }
            }
        }, [id, schemaId, current, outputId, schema, setManualOutputType]);

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
                        <TypeTags
                            isOptional={false}
                            type={type}
                        />
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
