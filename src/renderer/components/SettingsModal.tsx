import { LinkIcon, SettingsIcon, SmallCloseIcon } from '@chakra-ui/icons';
import {
    Button,
    HStack,
    Icon,
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
import { memo, useCallback, useState } from 'react';
import { BsFillPencilFill, BsPaletteFill } from 'react-icons/bs';
import { FaPython, FaTools } from 'react-icons/fa';
import { useContext } from 'use-context-selector';
import { isMac } from '../../common/env';
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
    const { useStartupTemplate } = useContext(SettingsContext);

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

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
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
            </SettingContainer>
            <Text>Looking for the CPU and FP16 settings? They moved to the Python tab.</Text>
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
                                description="If wanted, use a specific python binary rather than the default one invoked by 'python3' or 'python'. This is useful if you have multiple python versions installed and want to pick a specific one."
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
                                                placeholder="Select a file..."
                                                textOverflow="ellipsis"
                                                value={
                                                    systemPythonLocation
                                                        ? path.parse(systemPythonLocation).base
                                                        : ''
                                                }
                                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                                onClick={onButtonClick}
                                            />
                                        </InputGroup>
                                    </Tooltip>
                                    <IconButton
                                        aria-label="clear"
                                        icon={<SmallCloseIcon />}
                                        size="xs"
                                        onClick={() => setSystemPythonLocation(null)}
                                    />
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
                                            setBackendSettings((prev) =>
                                                produce(prev, (draftState) => {
                                                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                                                    if (!draftState[pkg.id]) {
                                                        // eslint-disable-next-line no-param-reassign
                                                        draftState[pkg.id] = {};
                                                    }
                                                    // eslint-disable-next-line no-param-reassign
                                                    draftState[pkg.id][setting.key] = value;
                                                })
                                            );
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
