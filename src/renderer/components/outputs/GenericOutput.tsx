import { Center, Flex, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { OutputData, OutputId } from '../../../common/common-types';
import { Type } from '../../../common/types/types';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTag } from '../TypeTag';
import { OutputContainer } from './OutputContainer';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: OutputId;
    definitionType: Type;
    useOutputData: (outputId: OutputId) => OutputData | undefined;
}

export const GenericOutput = memo(
    ({ label, id, outputId, definitionType, useOutputData }: GenericOutputProps) => {
        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(id)?.outputs.get(outputId)
        );

        const value = useOutputData(outputId);
        if (value) {
            console.log({ value });
        }

        return (
            <OutputContainer
                hasHandle
                definitionType={definitionType}
                id={id}
                outputId={outputId}
            >
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
            </OutputContainer>
        );
    }
);
