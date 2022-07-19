import { Center, Flex, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { OutputId } from '../../../common/common-types';
import { Type } from '../../../common/types/types';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTag } from '../TypeTag';
import { OutputContainer } from './OutputContainer';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: OutputId;
    definitionType: Type;
    useOutputData: (outputId: OutputId) => unknown;
}

export const GenericOutput = memo(
    ({ label, id, outputId, definitionType, useOutputData }: GenericOutputProps) => {
        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(id)?.outputs.get(outputId)
        );

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const value = useOutputData(outputId);

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
