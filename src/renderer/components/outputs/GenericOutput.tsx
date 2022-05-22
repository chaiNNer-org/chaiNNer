import { Text } from '@chakra-ui/react';
import { memo } from 'react';
import OutputContainer from './OutputContainer';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: number;
}

const GenericOutput = memo(({ label, id, outputId }: GenericOutputProps) => (
    <OutputContainer
        hasHandle
        id={id}
        outputId={outputId}
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
