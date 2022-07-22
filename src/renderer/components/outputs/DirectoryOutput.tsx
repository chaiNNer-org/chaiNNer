import { Center, Flex, Spacer, Text } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext, useContextSelector } from 'use-context-selector';
import { OutputId, SchemaId } from '../../../common/common-types';
import { NamedExpression, NamedExpressionField } from '../../../common/types/expression';
import { StringLiteralType, Type } from '../../../common/types/types';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTag } from '../TypeTag';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: OutputId;
    definitionType: Type;
    schemaId: SchemaId;
    useOutputData: (outputId: OutputId) => unknown;
}

export const DirectoryOutput = memo(
    ({ label, id, outputId, definitionType, schemaId, useOutputData }: GenericOutputProps) => {
        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(id)?.outputs.get(outputId)
        );

        const { setManualOutputType, schemata } = useContext(GlobalContext);

        const schema = schemata.get(schemaId);

        const value = useOutputData(outputId) as string;

        useEffect(() => {
            // Run this only if this is a "starting" node
            if (!schema.inputs.some((i) => i.hasHandle)) {
                if (value) {
                    setManualOutputType(
                        id,
                        outputId,
                        new NamedExpression('Directory', [
                            new NamedExpressionField('path', new StringLiteralType(value)),
                        ])
                    );
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
                        <TypeTag type={type} />
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
