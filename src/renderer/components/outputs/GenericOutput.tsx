import { Text } from '@chakra-ui/react';
import { memo } from 'react';
import { Type } from '../../../common/types/types';
import OutputContainer from './OutputContainer';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: number;
    type: Type;
}

const GenericOutput = memo(({ label, id, outputId, type }: GenericOutputProps) => (
    <OutputContainer
        hasHandle
        id={id}
        outputId={outputId}
        type={type}
    >
        <Text
            marginInlineEnd="0.5rem"
            mb={-1}
            mt={-1}
            textAlign="right"
            w="full"
        >
            {label}
        </Text>
    </OutputContainer>
));

export default GenericOutput;
