import { Box, HStack, Text } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext } from 'use-context-selector';
import { assertNever } from '../../../common/util';
import { ExecutionContext } from '../../contexts/ExecutionContext';
import { InputContext } from '../../contexts/InputContext';
import { WithoutLabel } from './InputContainer';
import { InputProps } from './props';

export const StaticValueInput = memo(
    ({ setValue, input }: InputProps<'static', number | string>) => {
        const { value } = input;
        const { executionNumber } = useContext(ExecutionContext);
        const { conditionallyInactive } = useContext(InputContext);

        useEffect(() => {
            switch (value) {
                case 'execution_number':
                    setValue(executionNumber);
                    break;
                default:
                    assertNever(value);
            }
        }, [setValue, value, executionNumber]);

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
                            {input.label}
                        </Text>
                    </HStack>
                </Box>
            </WithoutLabel>
        );
    }
);
