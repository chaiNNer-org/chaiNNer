import { LinkIcon, SettingsIcon, SmallCloseIcon } from '@chakra-ui/icons';
import {
    Button,
    Flex,
    HStack,
    IconButton,
    Input,
    InputGroup,
    InputLeftElement,
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
    useDisclosure,
} from '@chakra-ui/react';
import path from 'path';
import { PropsWithChildren, ReactNode, memo, useCallback, useEffect, useState } from 'react';
import { useContext } from 'use-context-selector';
import { ipcRenderer } from '../../common/safeIpc';
import { SettingsContext } from '../contexts/SettingsContext';

interface SettingsItemProps {
    title: ReactNode;
    description: ReactNode;
}

const SettingsItem = memo(
    ({ title, description, children }: PropsWithChildren<SettingsItemProps>) => {
        return (
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
                        {title}
                    </Text>
                    <Text
                        flex="1"
                        fontSize="xs"
                        marginTop={0}
                        textAlign="left"
                    >
                        {description}
                    </Text>
                </VStack>
                <HStack>{children}</HStack>
            </Flex>
        );
    }
);

interface ToggleProps extends SettingsItemProps {
    isDisabled?: boolean;
    value: boolean;
    onToggle: () => void;
}

const Toggle = memo(({ title, description, isDisabled, value, onToggle }: ToggleProps) => {
    return (
        <SettingsItem
            description={description}
            title={title}
        >
            <Switch
                defaultChecked={value}
                isChecked={value}
                isDisabled={isDisabled}
                size="lg"
                onChange={onToggle}
            />
        </SettingsItem>
    );
});

const AppearanceSettings = memo(() => {
    const { useSnapToGrid, useIsDarkMode, useAnimateChain } = useContext(SettingsContext);

    const [isDarkMode, setIsDarkMode] = useIsDarkMode;
    const [animateChain, setAnimateChain] = useAnimateChain;

    const [isSnapToGrid, setIsSnapToGrid, snapToGridAmount, setSnapToGridAmount] = useSnapToGrid;

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <Toggle
                description="Use dark mode throughout chaiNNer."
                title="Dark theme"
                value={isDarkMode}
                onToggle={() => {
                    setIsDarkMode((prev) => !prev);
                }}
            />

            <Toggle
                description="Enable animations that show the processing state of the chain."
                title="Chain animation"
                value={animateChain}
                onToggle={() => {
                    setAnimateChain((prev) => !prev);
                }}
            />

            <Toggle
                description="Enable node grid snapping."
                title="Snap to grid"
                value={isSnapToGrid}
                onToggle={() => {
                    setIsSnapToGrid((prev) => !prev);
                }}
            />

            <SettingsItem
                description="The amount to snap the grid to."
                title="Snap to grid amount"
            >
                <NumberInput
                    defaultValue={snapToGridAmount || 1}
                    max={45}
                    min={1}
                    value={Number(snapToGridAmount || 1)}
                    onChange={(number: string) => setSnapToGridAmount(Number(number || 1))}
                >
                    <NumberInputField />
                    <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                    </NumberInputStepper>
                </NumberInput>
            </SettingsItem>
        </VStack>
    );
});

const EnvironmentSettings = memo(() => {
    const { useIsCpu, useIsFp16, useStartupTemplate } = useContext(SettingsContext);

    const [startupTemplate, setStartupTemplate] = useStartupTemplate;

    const [isCpu, setIsCpu] = useIsCpu;
    const [isFp16, setIsFp16] = useIsFp16;

    useEffect(() => {
        if (isCpu && isFp16) {
            setIsFp16(false);
        }
    }, [isCpu]);

    const [lastDirectory, setLastDirectory] = useState(startupTemplate || '');

    const onButtonClick = useCallback(async () => {
        const fileDir = startupTemplate ? path.dirname(startupTemplate) : lastDirectory;
        const fileFilter = [
            {
                name: 'Select Chain',
                extensions: ['chn'],
            },
        ];
        const { canceled, filePaths } = await ipcRenderer.invoke(
            'file-select',
            fileFilter,
            false,
            fileDir
        );
        const selectedPath = filePaths[0];
        if (!canceled && selectedPath) {
            setStartupTemplate(selectedPath);
            setLastDirectory(path.dirname(selectedPath));
        }
    }, [startupTemplate, lastDirectory]);

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <SettingsItem
                description="Set a chain template to use by default when chaiNNer starts up."
                title="Startup Template"
            >
                <HStack>
                    <Tooltip
                        borderRadius={8}
                        label={startupTemplate}
                        maxW="auto"
                        openDelay={500}
                        px={2}
                        py={0}
                    >
                        <InputGroup>
                            <InputLeftElement pointerEvents="none">
                                <LinkIcon />
                            </InputLeftElement>

                            <Input
                                isReadOnly
                                alt="Pick startup template file"
                                className="nodrag"
                                cursor="pointer"
                                draggable={false}
                                placeholder="Select a file..."
                                textOverflow="ellipsis"
                                value={startupTemplate ? path.parse(startupTemplate).base : ''}
                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                onClick={onButtonClick}
                            />
                        </InputGroup>
                    </Tooltip>
                    <IconButton
                        aria-label="clear"
                        icon={<SmallCloseIcon />}
                        size="xs"
                        onClick={() => setStartupTemplate('')}
                    />
                </HStack>
            </SettingsItem>
            <Toggle
                description="Use CPU for PyTorch instead of GPU."
                title="CPU mode"
                value={isCpu}
                onToggle={() => {
                    setIsCpu((prev) => !prev);
                }}
            />

            <Toggle
                description="Runs PyTorch in half-precision (FP16) mode for less VRAM usage. RTX GPUs also get a speedup."
                title="FP16 mode"
                value={isFp16}
                onToggle={() => {
                    setIsFp16((prev) => !prev);
                }}
            />
        </VStack>
    );
});

const PythonSettings = memo(() => {
    const { useIsSystemPython } = useContext(SettingsContext);

    const [isSystemPython, setIsSystemPython] = useIsSystemPython;

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <Toggle
                description="Use system Python for chaiNNer's processing instead of the bundled Python (not recommended)"
                title="Use system Python (requires restart)"
                value={isSystemPython}
                onToggle={() => {
                    setIsSystemPython((prev) => !prev);
                }}
            />
        </VStack>
    );
});

const AdvancedSettings = memo(() => {
    const { useDisHwAccel } = useContext(SettingsContext);
    const [isDisHwAccel, setIsDisHwAccel] = useDisHwAccel;

    const { useCheckUpdOnStrtUp } = useContext(SettingsContext);
    const [isCheckUpdOnStrtUp, setIsCheckUpdOnStrtUp] = useCheckUpdOnStrtUp;

    const { useDiscordRPC } = useContext(SettingsContext);
    const [isDiscordRPC, setDiscordRPC] = useDiscordRPC;

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <Toggle
                description="Disable GPU hardware acceleration for rendering chaiNNer's UI. Only disable this is you know hardware acceleration is causing you issues."
                title="Disable Hardware Acceleration (requires restart)"
                value={isDisHwAccel}
                onToggle={() => {
                    setIsDisHwAccel((prev) => !prev);
                }}
            />
            <Toggle
                description="Toggles checking for updates on start-up."
                title="Check for Update on Start-up"
                value={isCheckUpdOnStrtUp}
                onToggle={() => {
                    setIsCheckUpdOnStrtUp((prev) => !prev);
                }}
            />
            <Toggle
                description="Enable Discord Rich Presence integration"
                title="Discord Rich Presence"
                value={isDiscordRPC}
                onToggle={() => {
                    setDiscordRPC((prev) => !prev);
                }}
            />
        </VStack>
    );
});

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal = memo(({ isOpen, onClose }: SettingsModalProps) => {
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
});

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
