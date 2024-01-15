import { Box, Center, HStack, Text } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext } from 'use-context-selector';
import { ExecutionContext } from '../../contexts/ExecutionContext';
import { InputContext } from '../../contexts/InputContext';
import { TypeTags } from '../TypeTag';
import { WithoutLabel } from './InputContainer';
import { InputProps } from './props';

export const StaticValueInput = memo(
    ({ value, setValue, input, definitionType }: InputProps<'static', number | string>) => {
        const { valueOf } = input;
        const { executionNumber } = useContext(ExecutionContext);
        const { conditionallyInactive } = useContext(InputContext);

        useEffect(() => {
            switch (valueOf) {
                case 'execution_number':
                    setValue(executionNumber);
                    break;
                default:
                    setValue(0);
                    break;
            }
        }, [setValue, valueOf, executionNumber]);

        return (
            <WithoutLabel>
                <Box
                    display="flex"
                    flexDirection="row"
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
                            {value}
                        </Text>
                        <Center>
                            <TypeTags
                                isOptional={false}
                                type={definitionType}
                            />
                        </Center>
                    </HStack>
                </Box>
            </WithoutLabel>
        );
    }
);
