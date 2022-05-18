import { SettingsIcon } from '@chakra-ui/icons';
import {
    Button,
    Flex,
    HStack,
    IconButton,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    StackDivider,
    Switch,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Text,
    Tooltip,
    VStack,
    useColorMode,
    useDisclosure,
} from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { useContext } from 'use-context-selector';
import { ipcRenderer } from '../../common/safeIpc';
import { SettingsContext } from '../contexts/SettingsContext';
import { useAsyncEffect } from '../hooks/useAsyncEffect';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
    const { useIsCpu, useIsFp16, useIsSystemPython, useSnapToGrid, useDisHwAccel } =
        useContext(SettingsContext);

    const { colorMode, toggleColorMode } = useColorMode();

    const [isCpu, setIsCpu] = useIsCpu;
    const [isFp16, setIsFp16] = useIsFp16;
    const [isSystemPython, setIsSystemPython] = useIsSystemPython;
    const [isSnapToGrid, setIsSnapToGrid, snapToGridAmount, setSnapToGridAmount] = useSnapToGrid;
    const [isDisHwAccel, setIsDisHwAccel] = useDisHwAccel;

    useAsyncEffect(
        {
            supplier: async () => (await ipcRenderer.invoke('get-gpu-name')) || 'GPU not detected',
            successEffect: (gpuName) => {
                if (gpuName.toLowerCase().includes('rtx')) {
                    setIsFp16(true);
                }
            },
        },
        []
    );

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
                        size="lg"
                        onChange={() => {
                            toggleColorMode();
                        }}
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
                        size="lg"
                        onChange={(event) => {
                            setIsSnapToGrid(event.target.checked);
                        }}
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
                        defaultValue={snapToGridAmount || 1}
                        max={45}
                        min={1}
                        value={Number(snapToGridAmount || 1)}
                        onChange={(number) => setSnapToGridAmount(Number(number || 1))}
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
                        Use CPU for PyTorch instead of GPU. This option does not affect NCNN.
                    </Text>
                </VStack>
                <HStack>
                    <Switch
                        defaultChecked={isCpu}
                        size="lg"
                        onChange={(event) => {
                            setIsCpu(event.target.checked);
                        }}
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
                        Runs PyTorch in half-precision (FP16) mode for less VRAM usage. RTX GPUs
                        also get a speedup. This setting does not affect NCNN.
                    </Text>
                </VStack>
                <HStack>
                    <Switch
                        defaultChecked={isFp16}
                        size="lg"
                        onChange={(event) => {
                            setIsFp16(event.target.checked);
                        }}
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
                        Use system Python for chaiNNer&apos;s processing instead of the bundled
                        Python (not recommended)
                    </Text>
                </VStack>
                <HStack>
                    <Switch
                        defaultChecked={isSystemPython}
                        size="lg"
                        onChange={(event) => {
                            setIsSystemPython(event.target.checked);
                        }}
                    />
                </HStack>
            </Flex>
        </VStack>
    );

    const AdvancedSettings = () => (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            {/* Disable Hardware Acceleration */}
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
                        Disable Hardware Acceleration (requires restart)
                    </Text>
                    <Text
                        flex="1"
                        fontSize="xs"
                        marginTop={0}
                        textAlign="left"
                    >
                        Disable GPU hardware acceleration for rendering chaiNNer&apos;s UI. Only
                        disable this is you know hardware acceleration is causing you issues.
                    </Text>
                </VStack>
                <HStack>
                    <Switch
                        defaultChecked={isDisHwAccel}
                        size="lg"
                        onChange={(event) => {
                            setIsDisHwAccel(event.target.checked);
                        }}
                    />
                </HStack>
            </Flex>
        </VStack>
    );

    return (
        <Modal
            isCentered
            isOpen={isOpen}
            returnFocusOnClose={false}
            scrollBehavior="inside"
            size="xl"
            onClose={onClose}
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
                            <Tab>Advanced</Tab>
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
                            <TabPanel>
                                <AdvancedSettings />
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </ModalBody>

                <ModalFooter>
                    <HStack>
                        <Button
                            variant="ghost"
                            // eslint-disable-next-line @typescript-eslint/no-misused-promises
                            onClick={async () => {
                                await ipcRenderer.invoke('relaunch-application');
                            }}
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
        isOpen: isSettingsOpen,
        onOpen: onSettingsOpen,
        onClose: onSettingsClose,
    } = useDisclosure();
    return (
        <>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label="Settings"
                px={2}
                py={1}
            >
                <IconButton
                    aria-label="Settings"
                    icon={<SettingsIcon />}
                    size="md"
                    variant="outline"
                    onClick={onSettingsOpen}
                >
                    Settings
                </IconButton>
            </Tooltip>
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={onSettingsClose}
            />
        </>
    );
});

export default memo(SettingsModal);
