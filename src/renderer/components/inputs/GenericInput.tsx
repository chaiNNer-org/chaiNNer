import { QuestionIcon } from '@chakra-ui/icons';
import { Box, Center, HStack, Text, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { useContext } from 'use-context-selector';
import { InputContext } from '../../contexts/InputContext';
import { Markdown } from '../Markdown';
import { TypeTags } from '../TypeTag';
import { WithoutLabel } from './InputContainer';
import { InputProps } from './props';

export const GenericInput = memo(({ input, definitionType }: InputProps<'generic'>) => {
    const { label, optional, hint, description } = input;

    const { conditionallyInactive } = useContext(InputContext);

    return (
        <WithoutLabel>
            <Box
                display="flex"
                flexDirection="row"
            >
                <Tooltip
                    hasArrow
                    borderRadius={8}
                    label={
                        hint ? <Markdown nonInteractive>{description ?? ''}</Markdown> : undefined
                    }
                    openDelay={500}
                    px={2}
                    py={1}
                >
                    <HStack
                        m={0}
                        p={0}
                        spacing={0}
                    >
                        <Text
                            opacity={conditionallyInactive ? 0.7 : undefined}
                            textDecoration={conditionallyInactive ? 'line-through' : undefined}
                        >
                            {label}
                        </Text>
                        {hint && (
                            <Center
                                h="auto"
                                m={0}
                                p={0}
                            >
                                <QuestionIcon
                                    boxSize={3}
                                    ml={1}
                                />
                            </Center>
                        )}
                        <Center>
                            <TypeTags
                                isOptional={optional}
                                type={definitionType}
                            />
                        </Center>
                    </HStack>
                </Tooltip>
            </Box>
        </WithoutLabel>
    );
});
