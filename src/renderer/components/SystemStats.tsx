import { Box, CircularProgress, CircularProgressLabel, HStack, Tooltip } from '@chakra-ui/react';
import { memo } from 'react';
import { useSystemUsage } from '../hooks/useSystemUsage';

export const SystemStats = memo(() => {
    const usage = useSystemUsage(2500);
    const trackColor = 'var(--bg-700)';
    return (
        <HStack>
            <Tooltip
                borderRadius={8}
                label={`${usage.cpu.toFixed(1)}%`}
                px={2}
                py={1}
            >
                <Box>
                    <CircularProgress
                        capIsRound
                        color={usage.cpu < 90 ? 'blue.400' : 'red.400'}
                        size="42px"
                        trackColor={trackColor}
                        value={usage.cpu}
                    >
                        <CircularProgressLabel>CPU</CircularProgressLabel>
                    </CircularProgress>
                </Box>
            </Tooltip>

            <Tooltip
                borderRadius={8}
                label={`${usage.ram.toFixed(1)}%`}
                px={2}
                py={1}
            >
                <Box>
                    <CircularProgress
                        capIsRound
                        color={usage.ram < 90 ? 'blue.400' : 'red.400'}
                        size="42px"
                        trackColor={trackColor}
                        value={usage.ram}
                    >
                        <CircularProgressLabel>RAM</CircularProgressLabel>
                    </CircularProgress>
                </Box>
            </Tooltip>

            {usage.vram !== null && (
                <Tooltip
                    borderRadius={8}
                    label={`${usage.vram.toFixed(1)}%`}
                    px={2}
                    py={1}
                >
                    <Box>
                        <CircularProgress
                            capIsRound
                            color={usage.vram < 90 ? 'blue.400' : 'red.400'}
                            size="42px"
                            trackColor={trackColor}
                            value={usage.vram}
                        >
                            <CircularProgressLabel>VRAM</CircularProgressLabel>
                        </CircularProgress>
                    </Box>
                </Tooltip>
            )}
        </HStack>
    );
});
