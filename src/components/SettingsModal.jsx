import { SettingsIcon } from '@chakra-ui/icons';
import {
  Button, Flex, HStack, IconButton, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, NumberDecrementStepper, NumberIncrementStepper,
  NumberInput, NumberInputField, NumberInputStepper, StackDivider,
  Switch, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Tooltip,
  useColorMode, useDisclosure, VStack,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import {
  memo, useContext, useEffect, useState,
} from 'react';
import { SettingsContext } from '../helpers/contexts/SettingsContext.jsx';

const SettingsModal = ({ isOpen, onClose }) => {
  const {
    useIsCpu,
    useIsFp16,
    useIsSystemPython,
    useSnapToGrid,
  } = useContext(SettingsContext);

  const { colorMode, toggleColorMode } = useColorMode();

  const [isCpu, setIsCpu] = useIsCpu;
  const [isFp16, setIsFp16] = useIsFp16;
  const [isSystemPython, setIsSystemPython] = useIsSystemPython;
  const [isSnapToGrid, setIsSnapToGrid, snapToGridAmount, setSnapToGridAmount] = useSnapToGrid;

  const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const gpuName = await ipcRenderer.invoke('get-gpu-name') || 'GPU not detected';
      const hasNvidia = await ipcRenderer.invoke('get-has-nvidia');
      if (gpuName.toLowerCase().includes('rtx')) {
        setIsFp16(true);
      }
      setIsNvidiaAvailable(hasNvidia);
    })();
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
    <VStack
      divider={<StackDivider />}
      w="full"
    >
      {/* Dark Theme */}
      <Flex
        align="center"
        w="full"
      >
        <VStack
          alignContent="left"
          alignItems="left"
          w="full"
        >
          <Text
            flex="1"
            textAlign="left"
          >
            Dark theme
          </Text>
          <Text
            flex="1"
            fontSize="xs"
            marginTop={0}
            textAlign="left"
          >
            Use dark mode throughout chaiNNer.
          </Text>
        </VStack>
        <HStack>
          <Switch
            defaultChecked={colorMode === 'dark'}
            onChange={() => { toggleColorMode(); }}
            size="lg"
            value={colorMode === 'dark'}
          />
        </HStack>
      </Flex>
      {/* Snap To Grid */}
      <Flex
        align="center"
        w="full"
      >
        <VStack
          alignContent="left"
          alignItems="left"
          w="full"
        >
          <Text
            flex="1"
            textAlign="left"
          >
            Snap to grid
          </Text>
          <Text
            flex="1"
            fontSize="xs"
            marginTop={0}
            textAlign="left"
          >
            Enable node grid snapping.
          </Text>
        </VStack>
        <HStack>
          <Switch
            defaultChecked={isSnapToGrid}
            onChange={() => { setIsSnapToGrid(!isSnapToGrid); }}
            size="lg"
            value={isSnapToGrid}
          />
        </HStack>
      </Flex>
      {/* Snap To Grid Amount */}
      <Flex
        align="center"
        w="full"
      >
        <VStack
          alignContent="left"
          alignItems="left"
          w="full"
        >
          <Text
            flex="1"
            textAlign="left"
          >
            Snap to grid amount
          </Text>
          <Text
            flex="1"
            fontSize="xs"
            marginTop={0}
            textAlign="left"
          >
            The amount to snap the grid to.
          </Text>
        </VStack>
        <HStack>
          <NumberInput
            defaultValue={snapToGridAmount}
            max={45}
            min={1}
            onChange={(number) => setSnapToGridAmount(Number(number ?? 1))}
            value={snapToGridAmount ?? 1}
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
    <VStack
      divider={<StackDivider />}
      w="full"
    >
      <Flex
        align="center"
        w="full"
      >
        <VStack
          alignContent="left"
          alignItems="left"
          w="full"
        >
          <Text
            flex="1"
            textAlign="left"
          >
            CPU mode
          </Text>
          <Text
            flex="1"
            fontSize="xs"
            marginTop={0}
            textAlign="left"
          >
            Use CPU for PyTorch inference instead of GPU.
            Forced if Nvidia (CUDA) GPU not detected.
          </Text>
        </VStack>
        <HStack>
          <Switch
            defaultChecked={isCpu}
            isDisabled={!isNvidiaAvailable}
            onChange={() => { setIsCpu(!isCpu); }}
            size="lg"
            value={isCpu}
          />
        </HStack>
      </Flex>

      <Flex
        align="center"
        w="full"
      >
        <VStack
          alignContent="left"
          alignItems="left"
          w="full"
        >
          <Text
            flex="1"
            textAlign="left"
          >
            FP16 mode
          </Text>
          <Text
            flex="1"
            fontSize="xs"
            marginTop={0}
            textAlign="left"
          >
            Runs PyTorch inference in half-precision (FP16) mode for less VRAM usage.
            RTX GPUs also get an inference speedup.
          </Text>
        </VStack>
        <HStack>
          <Switch
            defaultChecked={isFp16}
            isDisabled={isCpu}
            onChange={() => { setIsFp16(!isFp16); }}
            size="lg"
            value={isFp16}
          />
        </HStack>
      </Flex>
    </VStack>
  );

  const PythonSettings = () => (
    <VStack
      divider={<StackDivider />}
      w="full"
    >
      <Flex
        align="center"
        w="full"
      >
        <VStack
          alignContent="left"
          alignItems="left"
          w="full"
        >
          <Text
            flex="1"
            textAlign="left"
          >
            Use system Python (requires restart)
          </Text>
          <Text
            flex="1"
            fontSize="xs"
            marginTop={0}
            textAlign="left"
          >
            {'Use system Python for chaiNNer\'s processing instead of the bundled Python (not recommended)'}
          </Text>
        </VStack>
        <HStack>
          <Switch
            defaultChecked={isSystemPython}
            onChange={() => { setIsSystemPython(!isSystemPython); }}
            size="lg"
            value={isSystemPython}
          />
        </HStack>
      </Flex>
    </VStack>
  );

  return (
    <Modal
      isCentered
      isOpen={isOpen}
      onClose={onClose}
      returnFocusOnClose={false}
      scrollBehavior="inside"
      size="xl"
    >
      <ModalOverlay />
      <ModalContent
        maxH="500px"
        maxW="750px"
        minH="500px"
        minW="750px"
      >
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
              onClick={() => {
                ipcRenderer.invoke('relaunch-application');
              }}
              variant="ghost"
            >
              Restart chaiNNer
            </Button>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={onClose}
            >
              Close
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const SettingsButton = memo(() => {
  const {
    isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose,
  } = useDisclosure();
  return (
    <>
      <Tooltip
        borderRadius={8}
        closeOnClick
        closeOnMouseDown
        label="Settings"
        px={2}
        py={1}
      >
        <IconButton
          icon={<SettingsIcon />}
          onClick={onSettingsOpen}
          size="md"
          variant="outline"
        >
          Settings
        </IconButton>
      </Tooltip>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={onSettingsClose}
        onOpen={onSettingsOpen}
      />
    </>
  );
});

export default memo(SettingsModal);
