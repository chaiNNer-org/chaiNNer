import { TimeIcon } from '@chakra-ui/icons';
import { HStack, Text, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';

interface TimerProps {
    time: number;
}

export const Timer = memo(({ time }: TimerProps) => {
    return (
        <Tooltip
            hasArrow
            borderRadius={8}
            closeOnClick={false}
            gutter={24}
            label={`Execution took approximately ${time.toPrecision(6)} seconds.`}
            px={2}
            textAlign="center"
        >
            <HStack
                bgColor="var(--node-timer-bg)"
                borderRadius="full"
                h="full"
                margin="auto"
                px={1}
                spacing={0.5}
                width="auto"
            >
                <TimeIcon
                    boxSize="0.5rem"
                    color="var(--node-timer-fg)"
                />
                <Text
                    color="var(--node-timer-fg)"
                    fontSize="xx-small"
                    textAlign="right"
                >
                    {Number(time.toFixed(2))}s
                </Text>
            </HStack>
        </Tooltip>
    );
});
