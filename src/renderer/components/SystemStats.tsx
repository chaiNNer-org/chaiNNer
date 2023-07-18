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
                const response = await backend.systemStats();
                return response;
            } catch (error) {
                log.error(error);
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
                data.map((usage) => (
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
                                color={usage.percent < 90 ? 'blue.400' : 'red.400'}
                                size="42px"
                                trackColor="var(--bg-700)"
                                value={usage.percent}
                            >
                                <CircularProgressLabel>{usage.label}</CircularProgressLabel>
                            </CircularProgress>
                        </Box>
                    </Tooltip>
                ))}
        </HStack>
    );
});
