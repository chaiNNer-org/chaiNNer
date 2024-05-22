import { Box, CircularProgress, CircularProgressLabel, HStack, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { useQuery } from 'react-query';
import { useContext } from 'use-context-selector';
import { log } from '../../common/log';
import { BackendContext } from '../contexts/BackendContext';

export const SystemStats = memo(() => {
    const { backend } = useContext(BackendContext);

    const { data } = useQuery({
        queryKey: 'systemUsage',
        queryFn: async () => {
            try {
                return await backend.systemUsage();
            } catch (error) {
                log.error(`Failed to fetch system usage from backend: ${String(error)}`);
                throw error;
            }
        },
        cacheTime: 0,
        retry: 25,
        refetchOnWindowFocus: false,
        refetchInterval: 2500,
    });

    return (
        <HStack>
            {data &&
                data.map((usage) => {
                    let color;
                    if (usage.percent < 75) {
                        color = 'green.400';
                    } else if (usage.percent < 90) {
                        color = 'yellow.400';
                    } else {
                        color = 'red.400';
                    }

                    return (
                        <Tooltip
                            borderRadius={8}
                            key={usage.label}
                            label={`${usage.percent.toFixed(1)}%`}
                            px={2}
                            py={1}
                        >
                            <Box key={usage.label}>
                                <CircularProgress
                                    capIsRound
                                    color={color}
                                    size="42px"
                                    trackColor="var(--bg-700)"
                                    value={usage.percent}
                                >
                                    <CircularProgressLabel>{usage.label}</CircularProgressLabel>
                                </CircularProgress>
                            </Box>
                        </Tooltip>
                    );
                })}
        </HStack>
    );
});
