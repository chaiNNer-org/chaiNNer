import { Box, IconButton, Tooltip } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { HiOutlineRefresh } from 'react-icons/hi';
import { SchemaInput } from '../inputs/SchemaInput';
import { GroupProps } from './props';

export const SeedGroup = memo(({ inputs, nodeState }: GroupProps<'seed'>) => {
    const { setInputValue, isLocked, connectedInputs } = nodeState;

    const [input] = inputs;
    const isInputLocked = connectedInputs.has(input.id);

    const setRandom = useCallback(() => {
        const RANDOM_MAX = 1e6;
        const randomValue = Math.floor(Math.random() * RANDOM_MAX);
        setInputValue(input.id, randomValue);
    }, [input.id, setInputValue]);

    return (
        <SchemaInput
            afterInput={
                <Box
                    alignSelf="end"
                    pb={1}
                >
                    <Tooltip
                        closeOnClick
                        closeOnPointerDown
                        hasArrow
                        borderRadius={8}
                        label="Random seed"
                        openDelay={500}
                    >
                        <IconButton
                            aria-label="Random Seed"
                            h="2rem"
                            icon={<HiOutlineRefresh />}
                            isDisabled={isLocked || isInputLocked}
                            minWidth={0}
                            size="md"
                            variant="outline"
                            w="2.4rem"
                            onClick={setRandom}
                        />
                    </Tooltip>
                </Box>
            }
            input={input}
            nodeState={nodeState}
        />
    );
});
