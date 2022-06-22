import { Text } from '@chakra-ui/react';
import { memo } from 'react';
import OutputContainer from './OutputContainer';

interface GenericOutputProps {
    id: string;
    label: string;
    outputId: number;
    accentColor: string;
    type: string;
}

const GenericOutput = memo(({ label, id, outputId, accentColor, type }: GenericOutputProps) => (
    <OutputContainer
        hasHandle
        accentColor={accentColor}
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
