/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Button, Flex, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField,
  NumberInputStepper, StackDivider, Switch, Tab, TabList,
  TabPanel, TabPanels, Tabs, Text, useColorMode, VStack,
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
    useIsSystemPython,
    useSnapToGrid,
  } = useContext(GlobalContext);

  const { colorMode, toggleColorMode } = useColorMode();

  const [isCpu, setIsCpu] = useIsCpu;
  const [isFp16, setIsFp16] = useIsFp16;
  const [isSystemPython, setIsSystemPython] = useIsSystemPython;
  const [isSnapToGrid, setIsSnapToGrid, snapToGridAmount, setSnapToGridAmount] = useSnapToGrid;

  const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);

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

  const AppearanceSettings = () => (
    <VStack w="full" divider={<StackDivider />}>
      {/* Dark Theme */}
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
      {/* Snap To Grid */}
      <Flex align="center" w="full">
        <VStack w="full" alignItems="left" alignContent="left">
          <Text flex="1" textAlign="left">
            Snap to grid
          </Text>
          <Text flex="1" textAlign="left" fontSize="xs" marginTop={0}>
            Enable node grid snapping.
          </Text>
        </VStack>
        <HStack>
          <Switch size="lg" value={isSnapToGrid} defaultChecked={isSnapToGrid} onChange={() => { setIsSnapToGrid(!isSnapToGrid); }} />
        </HStack>
      </Flex>
      {/* Snap To Grid Amount */}
      <Flex align="center" w="full">
        <VStack w="full" alignItems="left" alignContent="left">
          <Text flex="1" textAlign="left">
            Snap to grid amount
          </Text>
          <Text flex="1" textAlign="left" fontSize="xs" marginTop={0}>
            The amount to snap the grid to.
          </Text>
        </VStack>
        <HStack>
          <NumberInput
            defaultValue={snapToGridAmount}
            min={0}
            max={45}
            onChange={(_, valueNumber) => setSnapToGridAmount(valueNumber)}
            value={snapToGridAmount}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </HStack>
      </Flex>
    </VStack>
  );

  const EnvironmentSettings = () => (
    <VStack w="full" divider={<StackDivider />}>
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
  );

  const PythonSettings = () => (
    <VStack w="full" divider={<StackDivider />}>
      <Flex align="center" w="full">
        <VStack w="full" alignItems="left" alignContent="left">
          <Text flex="1" textAlign="left">
            Use system Python (requires restart)
          </Text>
          <Text flex="1" textAlign="left" fontSize="xs" marginTop={0}>
            {'Use system Python for chaiNNer\'s processing instead of the bundled Python (not recommended)'}
          </Text>
        </VStack>
        <HStack>
          <Switch size="lg" value={isSystemPython} defaultChecked={isSystemPython} onChange={() => { setIsSystemPython(!isSystemPython); }} />
        </HStack>
      </Flex>
    </VStack>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside" size="xl">
      <ModalOverlay />
      <ModalContent maxW="750px" minW="750px" maxH="500px" minH="500px">
        <ModalHeader>Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Tabs>
            <TabList>
              <Tab>Appearance</Tab>
              <Tab>Environment</Tab>
              <Tab>Python</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <AppearanceSettings />
              </TabPanel>
              <TabPanel>
                <EnvironmentSettings />
              </TabPanel>
              <TabPanel>
                <PythonSettings />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter>
          <HStack>
            <Button
              variant="ghost"
              onClick={() => {
                ipcRenderer.invoke('relaunch-application');
              }}
            >
              Restart chaiNNer
            </Button>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default memo(SettingsModal);
