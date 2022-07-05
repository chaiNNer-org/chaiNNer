import { Flex, Spacer, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useContextSelector } from 'use-context-selector';
import { Type } from '../../../common/types/types';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { TypeTag } from '../TypeTag';
import OutputContainer from './OutputContainer';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: number;
    definitionType: Type;
}

const GenericOutput = memo(({ label, id, outputId, definitionType }: GenericOutputProps) => {
    const type = useContextSelector(GlobalVolatileContext, (c) =>
        c.typeState.functions.get(id)?.outputs.get(outputId)
    );

    return (
        <OutputContainer
            hasHandle
            definitionType={definitionType}
            id={id}
            outputId={outputId}
        >
            <Flex w="full">
                <Spacer />
                {type && <TypeTag type={type} />}
                <Text
                    marginInlineEnd="0.5rem"
                    mb={-1}
                    ml={1}
                    mt={-1}
                    textAlign="right"
                >
                    {label}
                </Text>
            </Flex>
        </OutputContainer>
    );
});

export default GenericOutput;
