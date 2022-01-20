/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Button, Flex, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, StackDivider, Switch, Text, useColorMode, VStack,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, {
  memo, useContext, useEffect, useState,
} from 'react';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';

const SettingsModal = ({ isOpen, onClose }) => {
  const {
    useIsCpu,
    useIsFp16,
  } = useContext(GlobalContext);

  const [isCpu, setIsCpu] = useIsCpu;
  const [isFp16, setIsFp16] = useIsFp16;
  const { colorMode, toggleColorMode } = useColorMode();

  // const [gpuInfo, setGpuInfo] = useState([]);
  const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);
  // const [isFp16Available, setIsFp16Available] = useState(false);

  useEffect(async () => {
    const gpuName = await ipcRenderer.invoke('get-gpu-name') || 'GPU not detected';
    const hasNvidia = await ipcRenderer.invoke('get-has-nvidia');
    if (gpuName.toLowerCase().includes('rtx')) {
      setIsFp16(true);
    }
    setIsNvidiaAvailable(hasNvidia);
  }, []);

  useEffect(() => {
    setIsCpu(!isNvidiaAvailable);
  }, [isNvidiaAvailable]);

  useEffect(() => {
    if (isCpu && isFp16) {
      setIsFp16(false);
    }
  }, [isCpu]);

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
                <Switch size="lg" value={colorMode === 'dark'} defaultChecked={colorMode === 'dark'} onChange={() => { toggleColorMode(); }} />
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
                <Switch size="lg" isDisabled={!isNvidiaAvailable} value={isCpu} defaultChecked={isCpu} onChange={() => { setIsCpu(!isCpu); }} />
              </HStack>
            </Flex>

            <Flex align="center" w="full">
              <VStack w="full" alignItems="left" alignContent="left">
                <Text flex="1" textAlign="left">
                  FP16 mode
                </Text>
                <Text flex="1" textAlign="left" fontSize="xs" marginTop={0}>
                  Runs PyTorch inference in half-precision (FP16) mode for less VRAM usage.
                  RTX GPUs also get an inference speedup.
                </Text>
              </VStack>
              <HStack>
                <Switch size="lg" isDisabled={isCpu} value={isFp16} defaultChecked={isFp16} onChange={() => { setIsFp16(!isFp16); }} />
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
};

export default memo(SettingsModal);
