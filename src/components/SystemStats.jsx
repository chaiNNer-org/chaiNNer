/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Box, CircularProgress, CircularProgressLabel, HStack, Tooltip, useColorModeValue,
} from '@chakra-ui/react';
import React, { memo } from 'react';
import useSystemUsage from '../helpers/hooks/useSystemUsage.js';

const SystemStats = () => {
  const { cpuUsage, ramUsage, vramUsage } = useSystemUsage(2500);
  const trackColor = useColorModeValue('gray.300', 'gray.700');
  return (
    <HStack>
      <Tooltip
        label={`${Number(cpuUsage).toFixed(1)}%`}
        borderRadius={8}
        py={1}
        px={2}
      >
        <Box>
          <CircularProgress
            value={cpuUsage}
            color={cpuUsage < 90 ? 'blue.400' : 'red.400'}
            size="42px"
            capIsRound
            trackColor={trackColor}
          >
            <CircularProgressLabel>CPU</CircularProgressLabel>
          </CircularProgress>
        </Box>
      </Tooltip>

      <Tooltip
        label={`${Number(ramUsage).toFixed(1)}%`}
        borderRadius={8}
        py={1}
        px={2}
      >
        <Box>
          <CircularProgress
            value={ramUsage}
            color={ramUsage < 90 ? 'blue.400' : 'red.400'}
            size="42px"
            capIsRound
            trackColor={trackColor}
          >
            <CircularProgressLabel>RAM</CircularProgressLabel>
          </CircularProgress>
        </Box>
      </Tooltip>

      {vramUsage && (
        <Tooltip
          label={`${Number(vramUsage).toFixed(1)}%`}
          borderRadius={8}
          py={1}
          px={2}
        >
          <Box>
            <CircularProgress
              value={vramUsage}
              color={vramUsage < 90 ? 'blue.400' : 'red.400'}
              size="42px"
              capIsRound
              trackColor={trackColor}
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
