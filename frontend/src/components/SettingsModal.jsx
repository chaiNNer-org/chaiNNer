/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Button, Flex, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Switch, Text, VStack, StackDivider, useColorMode,
} from '@chakra-ui/react';
import React, { memo, useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import useLocalStorage from '../helpers/useLocalStorage.js';

function SettingsModal({ isOpen, onClose }) {
  const [isCpu, setIsCpu] = useLocalStorage('is-cpu', false);
  const [isFp16, setIsFp16] = useLocalStorage('is-fp16', false);
  const { colorMode, toggleColorMode } = useColorMode();

  // const [gpuInfo, setGpuInfo] = useState([]);
  const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);
  const [isFp16Available, setIsFp16Available] = useState(false);

  useEffect(async () => {
    const fullGpuInfo = await ipcRenderer.invoke('get-gpu-info');
    const gpuNames = fullGpuInfo?.controllers.map((gpu) => gpu.model);
    // setGpuInfo(gpuNames);
    // Check if gpu string contains any nvidia-specific terms
    const nvidiaGpu = gpuNames.find(
      (gpu) => gpu.toLowerCase().split(' ').some(
        (item) => ['nvidia', 'geforce', 'gtx', 'rtx'].includes(item),
      ),
    );
    setIsFp16Available(nvidiaGpu.toLowerCase().includes('rtx'));
    setIsNvidiaAvailable(!!nvidiaGpu);
  }, []);

  useEffect(() => {
    setIsCpu(!isNvidiaAvailable);
  }, [isNvidiaAvailable]);

  useEffect(() => {
    setIsFp16(isFp16Available);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside" size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack w="full" divider={<StackDivider />}>
            <Flex align="center" w="full">
              <VStack w="full" alignItems="left" alignContent="left">
                <Text flex="1" textAlign="left">
                  Dark theme
                </Text>
                <Text flex="1" textAlign="left" fontSize="xs" marginTop={0}>
                  Use dark mode throughout chaiNNer.
                </Text>
              </VStack>
              <HStack>
                <Switch size="lg" value={colorMode === 'dark'} defaultIsChecked={colorMode === 'dark'} onChange={() => { toggleColorMode(); }} />
              </HStack>
            </Flex>

            <Flex align="center" w="full">
              <VStack w="full" alignItems="left" alignContent="left">
                <Text flex="1" textAlign="left">
                  CPU mode
                </Text>
                <Text flex="1" textAlign="left" fontSize="xs" marginTop={0}>
                  Use CPU for PyTorch inference instead of GPU.
                  Forced if Nvidia (CUDA) GPU not detected.
                </Text>
              </VStack>
              <HStack>
                <Switch size="lg" isDisabled={!isNvidiaAvailable} value={isNvidiaAvailable && isCpu} defaultIsChecked={isNvidiaAvailable && isCpu} onChange={() => { setIsCpu(!isCpu); }} />
              </HStack>
            </Flex>

            <Flex align="center" w="full">
              <VStack w="full" alignItems="left" alignContent="left">
                <Text flex="1" textAlign="left">
                  FP16 mode
                </Text>
                <Text flex="1" textAlign="left" fontSize="xs" marginTop={0}>
                  Runs PyTorch inference in half-precision (FP16) mode for a speedup.
                  Supported by RTX GPUs only.
                </Text>
              </VStack>
              <HStack>
                <Switch size="lg" isDisabled={!isFp16Available} value={isFp16Available && isFp16} defaultIsChecked={isFp16Available && isFp16} onChange={() => { setIsFp16(!isFp16); }} />
              </HStack>
            </Flex>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default memo(SettingsModal);
