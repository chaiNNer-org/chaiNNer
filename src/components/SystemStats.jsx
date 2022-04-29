import {
  Box,
  CircularProgress,
  CircularProgressLabel,
  HStack,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { memo } from 'react';
import useSystemUsage from '../helpers/hooks/useSystemUsage.js';

const SystemStats = () => {
  const { cpuUsage, ramUsage, vramUsage } = useSystemUsage(2500);
  const trackColor = useColorModeValue('gray.300', 'gray.700');
  return (
    <HStack>
      <Tooltip
        borderRadius={8}
        label={`${Number(cpuUsage).toFixed(1)}%`}
        px={2}
        py={1}
      >
        <Box>
          <CircularProgress
            capIsRound
            color={cpuUsage < 90 ? 'blue.400' : 'red.400'}
            size="42px"
            trackColor={trackColor}
            value={cpuUsage}
          >
            <CircularProgressLabel>CPU</CircularProgressLabel>
          </CircularProgress>
        </Box>
      </Tooltip>

      <Tooltip
        borderRadius={8}
        label={`${Number(ramUsage).toFixed(1)}%`}
        px={2}
        py={1}
      >
        <Box>
          <CircularProgress
            capIsRound
            color={ramUsage < 90 ? 'blue.400' : 'red.400'}
            size="42px"
            trackColor={trackColor}
            value={ramUsage}
          >
            <CircularProgressLabel>RAM</CircularProgressLabel>
          </CircularProgress>
        </Box>
      </Tooltip>

      {vramUsage && (
        <Tooltip
          borderRadius={8}
          label={`${Number(vramUsage).toFixed(1)}%`}
          px={2}
          py={1}
        >
          <Box>
            <CircularProgress
              capIsRound
              color={vramUsage < 90 ? 'blue.400' : 'red.400'}
              size="42px"
              trackColor={trackColor}
              value={vramUsage}
            >
              <CircularProgressLabel>VRAM</CircularProgressLabel>
            </CircularProgress>
          </Box>
        </Tooltip>
      )}
    </HStack>
  );
};

export default memo(SystemStats);
