import { LinkIcon, SettingsIcon, SmallCloseIcon } from '@chakra-ui/icons';
import {
    Button,
    Flex,
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
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    Select,
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
import { access, mkdir, readdir, unlink } from 'fs/promises';
import { produce } from 'immer';
import path from 'path';
import { PropsWithChildren, ReactNode, memo, useCallback, useEffect, useState } from 'react';
import { BsFillPencilFill, BsPaletteFill } from 'react-icons/bs';
import { FaPython, FaTools } from 'react-icons/fa';
import { useContext } from 'use-context-selector';
import { CacheSettingValue, Setting } from '../../common/common-types';
import { getCacheLocation, isMac } from '../../common/env';
import { log } from '../../common/log';
import { ipcRenderer } from '../../common/safeIpc';
import { assertNever } from '../../common/util';
import { BackendContext } from '../contexts/BackendContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { IconFactory } from './CustomIcons';

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

interface DropdownProps<T> extends SettingsItemProps {
    isDisabled?: boolean;
    value: T;
    options: readonly { label: string; value: T }[];
    onChange: (value: T) => void;
    small?: boolean;
}

// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, react-memo/require-memo
function Dropdown<T>({
    title,
    description,
    isDisabled,
    value,
    options,
    onChange,
    small,
}: DropdownProps<T>) {
    const index = options.findIndex((o) => o.value === value);

    useEffect(() => {
        if (index === -1 && !isDisabled) {
            if (options.length > 0) {
                onChange(options[0].value);
            }
        }
    }, [index, options, onChange, isDisabled]);

    return (
        <SettingsItem
            description={description}
            title={title}
        >
            <Select
                isDisabled={isDisabled}
                minWidth={small ? '171px' : '350px'}
                value={index === -1 ? 0 : index}
                onChange={(e) => {
                    if (options.length > 0) {
                        const optionIndex = Number(e.target.value);
                        onChange(options[optionIndex].value);
                    }
                }}
            >
                {(options.length === 0 ? [{ label: `No ${String(title)} found.` }] : options).map(
                    ({ label }, i) => (
                        <option
                            // eslint-disable-next-line react/no-array-index-key
                            key={i}
                            value={i}
                        >
                            {label}
                        </option>
                    )
                )}
            </Select>
        </SettingsItem>
    );
}

interface CacheSettingProps extends SettingsItemProps {
    isDisabled?: boolean;
    value?: CacheSettingValue;
    onChange: (value: CacheSettingValue) => void;
    cacheKey: string;
}

// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, react-memo/require-memo
function CacheSetting({
    description,
    title,
    isDisabled,
    value,
    onChange,
    cacheKey,
}: CacheSettingProps) {
    return (
        <HStack w="full">
            <Toggle
                description={description}
                isDisabled={isDisabled}
                title={title}
                value={value?.enabled ?? false}
                onToggle={() => {
                    if (!value?.enabled) {
                        // Make sure the cache directory exists
                        ipcRenderer
                            .invoke('get-appdata')
                            .then(async (appDataPath: string) => {
                                const cacheLocation = getCacheLocation(appDataPath, cacheKey);
                                try {
                                    await access(cacheLocation);
                                } catch (error) {
                                    await mkdir(cacheLocation, { recursive: true });
                                }
                                onChange({
                                    enabled: true,
                                    location: cacheLocation,
                                });
                            })
                            .catch(log.error);
                    } else {
                        onChange({
                            enabled: false,
                            location: value.location,
                        });
                    }
                }}
            />
            <Button
                isDisabled={isDisabled}
                onClick={() => {
                    ipcRenderer
                        .invoke('get-appdata')
                        .then(async (appDataPath: string) => {
                            const cacheLocation = getCacheLocation(appDataPath, cacheKey);
                            const files = await readdir(cacheLocation);
                            for (const file of files) {
                                unlink(path.join(cacheLocation, file)).catch(log.error);
                            }
                        })
                        .catch(log.error);
                }}
            >
                Clear Cache
            </Button>
        </HStack>
    );
}

interface SettingWrapperProps {
    setting: Setting;
    settingValue: string | number | boolean | undefined | CacheSettingValue;
    setSettingValue: (value: string | number | boolean | undefined | CacheSettingValue) => void;
}

// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, react-memo/require-memo
function SettingWrapper({ setting, settingValue, setSettingValue }: SettingWrapperProps) {
    useEffect(() => {
        if (settingValue === undefined) {
            setSettingValue(setting.default);
        }
    }, [setting, settingValue, setSettingValue]);

    switch (setting.type) {
        case 'toggle':
            return (
                <Toggle
                    description={setting.description}
                    isDisabled={setting.disabled}
                    title={setting.label}
                    value={Boolean(settingValue)}
                    onToggle={() => {
                        setSettingValue(!settingValue);
                    }}
                />
            );
        case 'dropdown':
            return (
                <Dropdown
                    description={setting.description}
                    isDisabled={setting.disabled}
                    options={setting.options}
                    title={setting.label}
                    value={String(settingValue)}
                    onChange={(v: string) => {
                        setSettingValue(v);
                    }}
                />
            );
        case 'number':
            return (
                <NumberInput
                    isDisabled={setting.disabled}
                    max={setting.max}
                    min={setting.min}
                    step={1}
                    value={String(settingValue)}
                    onChange={(v) => {
                        setSettingValue(v);
                    }}
                >
                    <NumberInputField />
                    <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                    </NumberInputStepper>
                </NumberInput>
            );
        case 'cache':
            return (
                <CacheSetting
                    cacheKey={setting.key}
                    description={setting.description}
                    isDisabled={setting.disabled}
                    title={setting.label}
                    value={settingValue as CacheSettingValue}
                    onChange={(v) => {
                        setSettingValue(v);
                    }}
                />
            );
        default:
            return assertNever(setting);
    }
}

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
            <Dropdown
                small
                description="Choose the Theme for chaiNNers appereance."
                options={[
                    { label: 'Dark Mode', value: 'dark' },
                    { label: 'Light Mode', value: 'light' },
                    { label: 'System', value: 'system' },
                ]}
                title="Select Theme"
                value={isSelectTheme}
                onChange={setSelectTheme}
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
                    max={45}
                    min={1}
                    value={snapToGridAmount}
                    onChange={(number: string) => {
                        const value = Number(number);

                        if (!Number.isNaN(value)) {
                            setSnapToGridAmount(value);
                        }
                    }}
                >
                    <NumberInputField />
                    <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                    </NumberInputStepper>
                </NumberInput>
            </SettingsItem>

            <SettingsItem
                description="The amount of padding for the viewport PNG export."
                title="Viewport PNG export padding"
            >
                <NumberInput
                    max={100}
                    min={0}
                    value={viewportExportPadding}
                    onChange={(number: string) => {
                        const value = Number(number);

                        if (!Number.isNaN(value)) {
                            setViewportExportPadding(value);
                        }
                    }}
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
                        <Toggle
                            description="Use system Python for chaiNNer's processing instead of the bundled Python (not recommended)"
                            title="Use system Python (requires restart)"
                            value={isSystemPython}
                            onToggle={() => {
                                setIsSystemPython((prev) => !prev);
                            }}
                        />
                        {isSystemPython && (
                            <SettingsItem
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
                            </SettingsItem>
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
                                    <SettingWrapper
                                        key={setting.key}
                                        setSettingValue={(value) => {
                                            setBackendSettings((prev) =>
                                                produce(prev, (draftState) => {
                                                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                                                    if (!draftState[pkg.id]) {
                                                        // eslint-disable-next-line no-param-reassign
                                                        draftState[pkg.id] = {};
                                                    }
                                                    // eslint-disable-next-line no-param-reassign
                                                    draftState[pkg.id][setting.key] =
                                                        value ?? prev[pkg.id][setting.key];
                                                })
                                            );
                                        }}
                                        setting={setting}
                                        settingValue={thisSetting}
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
            <Toggle
                description="Toggles checking for updates on start-up."
                title="Check for Update on Start-up"
                value={isCheckUpdOnStrtUp}
                onToggle={() => {
                    setIsCheckUpdOnStrtUp((prev) => !prev);
                }}
            />
            <Toggle
                description="Enable experimental features to try them out before they are finished."
                title="Enable experimental features"
                value={isExperimentalFeatures}
                onToggle={() => {
                    setIsExperimentalFeatures((prev) => !prev);
                }}
            />
            <Toggle
                description="Enable GPU rendering for the GUI. Use with caution, as it may severely decrease GPU performance for image processing."
                title="Enable Hardware Acceleration (requires restart)"
                value={isEnableHardwareAcceleration}
                onToggle={() => {
                    setIsEnableHardwareAcceleration((prev) => !prev);
                }}
            />
            {/* TODO: Not working on macOS ATM. A new window must be created. */}
            {!isMac && (
                <Toggle
                    description="Enable multiple concurrent instances of chaiNNer. This is not recommended, but if your chain is not using enough of your system resources, you might find this helpful for running things concurrently."
                    title="Allow multiple concurrent instances"
                    value={isAllowMultipleInstances}
                    onToggle={() => {
                        setIsAllowMultipleInstances((prev) => !prev);
                    }}
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
