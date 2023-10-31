import { LinkIcon, SettingsIcon, SmallCloseIcon } from '@chakra-ui/icons';
import {
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    Button,
    HStack,
    Icon,
    IconButton,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    StackDivider,
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
import { produce } from 'immer';
import path from 'path';
import { memo, useCallback, useRef, useState } from 'react';
import { BsFillPencilFill, BsPaletteFill } from 'react-icons/bs';
import { FaPython, FaTools } from 'react-icons/fa';
import { useContext } from 'use-context-selector';
import { SettingKey, SettingValue } from '../../common/common-types';
import { isArmMac, isMac, totalMemory } from '../../common/env';
import { ipcRenderer } from '../../common/safeIpc';
import { BackendContext } from '../contexts/BackendContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { IconFactory } from './CustomIcons';
import { DropdownSetting, NumberSetting, ToggleSetting } from './settings/components';
import { SettingContainer } from './settings/SettingContainer';
import { SettingItem } from './settings/SettingItem';

const AppearanceSettings = memo(() => {
    const { useSnapToGrid, useSelectTheme, useAnimateChain, useViewportExportPadding } =
        useContext(SettingsContext);

    const [isSelectTheme, setSelectTheme] = useSelectTheme;
    const [animateChain, setAnimateChain] = useAnimateChain;
    const [viewportExportPadding, setViewportExportPadding] = useViewportExportPadding;

    const [isSnapToGrid, setIsSnapToGrid, snapToGridAmount, setSnapToGridAmount] = useSnapToGrid;

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <DropdownSetting
                setValue={setSelectTheme}
                setting={{
                    label: 'Select Theme',
                    description: "Choose the Theme for chaiNNer's appearance.",
                    options: [
                        { label: 'Dark Mode', value: 'dark' },
                        { label: 'Light Mode', value: 'light' },
                        { label: 'System', value: 'system' },
                    ],
                    small: true,
                }}
                value={isSelectTheme}
            />

            <ToggleSetting
                setValue={setAnimateChain}
                setting={{
                    label: 'Chain animation',
                    description: 'Enable animations that show the processing state of the chain.',
                }}
                value={animateChain}
            />

            <ToggleSetting
                setValue={setIsSnapToGrid}
                setting={{
                    label: 'Snap to grid',
                    description: 'Enable node grid snapping.',
                }}
                value={isSnapToGrid}
            />

            <NumberSetting
                setValue={setSnapToGridAmount}
                setting={{
                    label: 'Snap to grid amount',
                    description: 'The amount to snap the grid to.',
                    max: 45,
                    min: 1,
                }}
                value={snapToGridAmount}
            />

            <NumberSetting
                setValue={setViewportExportPadding}
                setting={{
                    label: 'Viewport PNG export padding',
                    description: 'The amount of padding for the viewport PNG export.',
                    max: 100,
                    min: 0,
                }}
                value={viewportExportPadding}
            />
        </VStack>
    );
});

const EnvironmentSettings = memo(() => {
    const {
        useStartupTemplate,
        useMemoryForUpscaling,
        useIsSystemMemory,
        useMemoryForUpscalingGPU,
    } = useContext(SettingsContext);

    const [startupTemplate, setStartupTemplate] = useStartupTemplate;

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
    }, [startupTemplate, lastDirectory, setStartupTemplate]);

    const [memoryForUpscaling, setMemoryForUpscaling] = useMemoryForUpscaling;
    const [isSystemMemory, setIsSystemMemory] = useIsSystemMemory;
    const [memoryForUpscalingGPU, setMemoryForUpscalingGPU] = useMemoryForUpscalingGPU;

    const systemMemory = () => totalMemory / 1024 ** 3;

    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    const cancelRef = useRef<HTMLButtonElement>(null);

    const handleConfirmationConfirm = () => {
        setIsConfirmationOpen(false);
        setIsSystemMemory(true);
    };

    const handleConfirmationCancel = () => {
        setIsConfirmationOpen(false);
    };

    const handleToggle = () => {
        if (!isSystemMemory) {
            setIsConfirmationOpen(true);
        } else {
            setIsSystemMemory(false);
        }
    };

    const confirmationDialog = (
        <AlertDialog
            isCentered
            isOpen={isConfirmationOpen}
            leastDestructiveRef={cancelRef}
            onClose={handleConfirmationCancel}
        >
            <AlertDialogOverlay />
            <AlertDialogContent>
                <AlertDialogHeader
                    fontSize="lg"
                    fontWeight="bold"
                >
                    Are you sure?
                </AlertDialogHeader>
                <AlertDialogBody
                    justifyContent="flex-end"
                    width="full"
                >
                    This action may result in <strong>heavy swapping</strong> and could potentially{' '}
                    <strong>render your system unusable</strong> when the <strong>limit</strong> is
                    set <strong>too high</strong>! Do you really want to continue?
                </AlertDialogBody>
                <AlertDialogFooter>
                    <Button
                        ref={cancelRef}
                        onClick={handleConfirmationCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        colorScheme="red"
                        ml={3}
                        onClick={handleConfirmationConfirm}
                    >
                        Yes, I know what I&#39;m doing
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            {!isArmMac && (
                <NumberSetting
                    setValue={setMemoryForUpscalingGPU}
                    setting={{
                        description:
                            'The maximum amount of freely available VRAM used for upscaling in auto mode.',
                        label: 'GPU memory limit for upscaling in auto mode',
                        max: 80,
                        min: 20,
                        step: 0.1,
                        width: 100,
                        unit: '%',
                    }}
                    value={memoryForUpscalingGPU}
                />
            )}
            <NumberSetting
                setValue={setMemoryForUpscaling}
                setting={{
                    description:
                        'The maximum amount of freely available RAM used for upscaling in auto mode.',
                    label: `Memory limit for ${!isArmMac ? 'CPU' : ''} upscaling in auto mode`,
                    max: 80,
                    min: 20,
                    step: 0.1,
                    width: 100,
                    unit: '%',
                }}
                value={memoryForUpscaling}
            />

            <HStack width="full">
                <ToggleSetting
                    setValue={handleToggle}
                    setting={{
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        description: (
                            <>
                                Up to{' '}
                                <Text
                                    as="span"
                                    fontWeight="bold"
                                >
                                    {(systemMemory() * (memoryForUpscaling / 100)).toFixed(1)} GiB
                                </Text>{' '}
                                out of a total of{' '}
                                <Text
                                    as="span"
                                    fontWeight="bold"
                                >
                                    {systemMemory()} GiB
                                </Text>{' '}
                                RAM will be used. Use with caution, may result in heavy swapping!
                            </>
                        ),
                        label: `Apply ${memoryForUpscaling.toFixed(
                            1
                        )}% memory limit to total system memory`,
                        disabled: false,
                    }}
                    value={isSystemMemory}
                />
                {confirmationDialog}
            </HStack>

            <SettingContainer
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
                                width={183}
                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                onClick={onButtonClick}
                            />

                            <InputRightElement
                                width="2.5rem"
                                zIndex={1}
                            >
                                <IconButton
                                    aria-label="clear"
                                    icon={<SmallCloseIcon />}
                                    size="xs"
                                    onClick={() => setStartupTemplate('')}
                                />
                            </InputRightElement>
                        </InputGroup>
                    </Tooltip>
                </HStack>
            </SettingContainer>
        </VStack>
    );
});

const PythonSettings = memo(() => {
    const { useIsSystemPython, useSystemPythonLocation, useBackendSettings } =
        useContext(SettingsContext);
    const [backendSettings, setBackendSettings] = useBackendSettings;

    const { packages } = useContext(BackendContext);
    const [isSystemPython, setIsSystemPython] = useIsSystemPython;
    const [systemPythonLocation, setSystemPythonLocation] = useSystemPythonLocation;
    const [lastDirectory, setLastDirectory] = useState(systemPythonLocation || '');

    const onButtonClick = useCallback(async () => {
        const fileDir = systemPythonLocation ? path.dirname(systemPythonLocation) : lastDirectory;
        const { canceled, filePaths } = await ipcRenderer.invoke('file-select', [], false, fileDir);
        const selectedPath = filePaths[0];
        if (!canceled && selectedPath) {
            setSystemPythonLocation(selectedPath);
            setLastDirectory(path.dirname(selectedPath));
        }
    }, [systemPythonLocation, lastDirectory, setSystemPythonLocation]);

    const packagesWithSettings = packages.filter((pkg) => pkg.settings.length);

    const setBackendPackageSetting = (pkg: string, key: SettingKey, value: SettingValue) =>
        setBackendSettings((prev) =>
            produce(prev, (draftState) => {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!draftState[pkg]) {
                    // eslint-disable-next-line no-param-reassign
                    draftState[pkg] = {};
                }
                // eslint-disable-next-line no-param-reassign
                draftState[pkg][key] = value;
            })
        );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const setGeneralBackendSetting = (key: SettingKey, value: SettingValue) =>
        setBackendPackageSetting('general', key, value);

    return (
        <Tabs
            isFitted
            px={0}
        >
            <TabList>
                <Tab>
                    <HStack cursor="pointer">
                        <Icon as={FaPython} />
                        <Text cursor="pointer">General</Text>
                    </HStack>
                </Tab>
                {packagesWithSettings.map((pkg) => (
                    <Tab key={pkg.name}>
                        <HStack cursor="pointer">
                            <IconFactory icon={pkg.icon} />
                            <Text cursor="pointer">{pkg.name}</Text>
                        </HStack>
                    </Tab>
                ))}
            </TabList>

            <TabPanels px={0}>
                <TabPanel px={0}>
                    <VStack
                        divider={<StackDivider />}
                        w="full"
                    >
                        <ToggleSetting
                            setValue={setIsSystemPython}
                            setting={{
                                label: 'Use system Python (requires restart)',
                                description:
                                    "Use system Python for chaiNNer's processing instead of the bundled Python (not recommended)",
                            }}
                            value={isSystemPython}
                        />
                        {isSystemPython && (
                            <SettingContainer
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                description={
                                    <Text>
                                        If wanted, use a specific python binary rather than the
                                        default one invoked by{' '}
                                        <Text
                                            as="span"
                                            fontWeight="bold"
                                        >
                                            python3
                                        </Text>{' '}
                                        or{' '}
                                        <Text
                                            as="span"
                                            fontWeight="bold"
                                        >
                                            python
                                        </Text>
                                        . This is useful if you have multiple python versions
                                        installed and want to pick a specific one.
                                    </Text>
                                }
                                title="System Python location (optional)"
                            >
                                <HStack>
                                    <Tooltip
                                        borderRadius={8}
                                        label={systemPythonLocation}
                                        maxW="auto"
                                        openDelay={500}
                                        px={2}
                                        py={0}
                                    >
                                        <InputGroup>
                                            <InputLeftElement pointerEvents="none">
                                                <Icon as={FaPython} />
                                            </InputLeftElement>

                                            <Input
                                                isReadOnly
                                                alt="Pick system python location"
                                                className="nodrag"
                                                cursor="pointer"
                                                draggable={false}
                                                marginLeft="1.5"
                                                placeholder="Select a file..."
                                                textOverflow="ellipsis"
                                                value={
                                                    systemPythonLocation
                                                        ? path.parse(systemPythonLocation).base
                                                        : ''
                                                }
                                                width={183}
                                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                                onClick={onButtonClick}
                                            />

                                            <InputRightElement
                                                width="2.5rem"
                                                zIndex={1}
                                            >
                                                <IconButton
                                                    aria-label="clear"
                                                    icon={<SmallCloseIcon />}
                                                    size="xs"
                                                    onClick={() => setSystemPythonLocation(null)}
                                                />
                                            </InputRightElement>
                                        </InputGroup>
                                    </Tooltip>
                                </HStack>
                            </SettingContainer>
                        )}
                    </VStack>
                </TabPanel>
                {packagesWithSettings.map((pkg) => (
                    <TabPanel
                        key={pkg.name}
                        px={0}
                    >
                        <VStack
                            divider={<StackDivider />}
                            w="full"
                        >
                            {pkg.settings.map((setting) => {
                                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                                const packageSettings = backendSettings[pkg.id] ?? {};
                                const thisSetting = packageSettings[setting.key];
                                return (
                                    <SettingItem
                                        key={setting.key}
                                        setValue={(value) => {
                                            setBackendPackageSetting(pkg.id, setting.key, value);
                                        }}
                                        setting={setting}
                                        value={thisSetting}
                                    />
                                );
                            })}
                        </VStack>
                    </TabPanel>
                ))}
            </TabPanels>
        </Tabs>
    );
});

const AdvancedSettings = memo(() => {
    const {
        useCheckUpdOnStrtUp,
        useExperimentalFeatures,
        useEnableHardwareAcceleration,
        useAllowMultipleInstances,
    } = useContext(SettingsContext);
    const [isCheckUpdOnStrtUp, setIsCheckUpdOnStrtUp] = useCheckUpdOnStrtUp;
    const [isExperimentalFeatures, setIsExperimentalFeatures] = useExperimentalFeatures;
    const [isEnableHardwareAcceleration, setIsEnableHardwareAcceleration] =
        useEnableHardwareAcceleration;
    const [isAllowMultipleInstances, setIsAllowMultipleInstances] = useAllowMultipleInstances;

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <ToggleSetting
                setValue={setIsCheckUpdOnStrtUp}
                setting={{
                    label: 'Check for Update on Start-up',
                    description: 'Toggles checking for updates on start-up.',
                }}
                value={isCheckUpdOnStrtUp}
            />
            <ToggleSetting
                setValue={setIsExperimentalFeatures}
                setting={{
                    label: 'Enable experimental features',
                    description:
                        'Enable experimental features to try them out before they are finished.',
                }}
                value={isExperimentalFeatures}
            />
            <ToggleSetting
                setValue={setIsEnableHardwareAcceleration}
                setting={{
                    label: 'Enable Hardware Acceleration (requires restart)',
                    description:
                        'Enable GPU rendering for the GUI. Use with caution, as it may severely decrease GPU performance for image processing.',
                }}
                value={isEnableHardwareAcceleration}
            />
            {/* TODO: Not working on macOS ATM. A new window must be created. */}
            {!isMac && (
                <ToggleSetting
                    setValue={setIsAllowMultipleInstances}
                    setting={{
                        label: 'Allow multiple concurrent instances',
                        description:
                            'Enable multiple concurrent instances of chaiNNer. This is not recommended, but if your chain is not using enough of your system resources, you might find this helpful for running things concurrently.',
                    }}
                    value={isAllowMultipleInstances}
                />
            )}
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
            // scrollBehavior="inside"
            returnFocusOnClose={false}
            size="xl"
            onClose={onClose}
        >
            <ModalOverlay />
            <ModalContent
                bgColor="var(--chain-editor-bg)"
                h="min(100% - 7.5rem, 600px)"
                maxW="unset"
                my={0}
                w="750px"
            >
                <ModalHeader>Settings</ModalHeader>
                <ModalCloseButton />
                <ModalBody
                    position="relative"
                    px={0}
                >
                    <Tabs
                        isFitted
                        bottom={0}
                        display="flex"
                        flexDirection="column"
                        left={0}
                        position="absolute"
                        right={0}
                        top={0}
                    >
                        <TabList>
                            <Tab>
                                <HStack cursor="pointer">
                                    <Icon as={BsPaletteFill} />
                                    <Text cursor="pointer">Appearance</Text>
                                </HStack>
                            </Tab>
                            <Tab>
                                <HStack cursor="pointer">
                                    <Icon as={BsFillPencilFill} />
                                    <Text cursor="pointer">Environment</Text>
                                </HStack>
                            </Tab>
                            <Tab>
                                <HStack cursor="pointer">
                                    <Icon as={FaPython} />
                                    <Text cursor="pointer">Python</Text>
                                </HStack>
                            </Tab>
                            <Tab>
                                <HStack cursor="pointer">
                                    <Icon as={FaTools} />
                                    <Text cursor="pointer">Advanced</Text>
                                </HStack>
                            </Tab>
                        </TabList>
                        <TabPanels
                            overflowY="scroll"
                            px={4}
                        >
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
