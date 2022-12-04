import { HStack, Icon, Text, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { BiStopwatch } from 'react-icons/bi';

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
                <Icon
                    as={BiStopwatch}
                    boxSize="0.75rem"
                    color="var(--node-timer-fg)"
                />
                <Text
                    color="var(--node-timer-fg)"
                    fontSize="xx-small"
                    fontWeight="500"
                    m={0}
                    textAlign="right"
                >
                    {Number(time.toFixed(2))}s
                </Text>
            </HStack>
        </Tooltip>
    );
});
