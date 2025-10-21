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
import path from 'path';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsFillPencilFill, BsPaletteFill } from 'react-icons/bs';
import { FaPython, FaTools } from 'react-icons/fa';
import { useContext } from 'use-context-selector';
import { isMac } from '../appConstants';
import { BackendContext } from '../contexts/BackendContext';
import { useMutSetting } from '../hooks/useSettings';
import { ipcRenderer } from '../safeIpc';
import { IconFactory } from './CustomIcons';
import { DropdownSetting, NumberSetting, ToggleSetting } from './settings/components';
import { SettingContainer } from './settings/SettingContainer';
import { SettingItem } from './settings/SettingItem';

const AppearanceSettings = memo(() => {
    const { t } = useTranslation();
    const [theme, setTheme] = useMutSetting('theme');
    const [language, setLanguage] = useMutSetting('language');
    const [animateChain, setAnimateChain] = useMutSetting('animateChain');
    const [viewportExportPadding, setViewportExportPadding] =
        useMutSetting('viewportExportPadding');
    const [snapToGrid, setSnapToGrid] = useMutSetting('snapToGrid');
    const [snapToGridAmount, setSnapToGridAmount] = useMutSetting('snapToGridAmount');
    const [showMinimap, setShowMinimap] = useMutSetting('showMinimap');

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <DropdownSetting
                setValue={(value) => setTheme(value)}
                setting={{
                    label: t('settings.appearance.colorTheme.label', 'Color Theme'),
                    description: t(
                        'settings.appearance.colorTheme.description',
                        "Choose the Theme for chaiNNer's appearance."
                    ),
                    options: [
                        {
                            label: t('settings.appearance.colorTheme.options.dark', 'Dark'),
                            value: 'default-dark',
                        },
                        {
                            label: t('settings.appearance.colorTheme.options.light', 'Light'),
                            value: 'default-light',
                        },
                        {
                            label: t('settings.appearance.colorTheme.options.system', 'System'),
                            value: 'default-system',
                        },
                        {
                            label: t('settings.appearance.colorTheme.options.charcoal', 'Charcoal'),
                            value: 'charcoal-dark',
                        },
                        {
                            label: t('settings.appearance.colorTheme.options.coffee', 'Coffee'),
                            value: 'coffee-dark',
                        },
                        {
                            label: t(
                                'settings.appearance.colorTheme.options.blueberry',
                                'Blueberry'
                            ),
                            value: 'blueberry-dark',
                        },
                        {
                            label: t('settings.appearance.colorTheme.options.dusk', 'Dusk'),
                            value: 'dusk-dark',
                        },
                        {
                            label: t('settings.appearance.colorTheme.options.oled', 'OLED'),
                            value: 'oled-dark',
                        },
                        {
                            label: t(
                                'settings.appearance.colorTheme.options.cyberpunk',
                                'Cyberpunk'
                            ),
                            value: 'cyberpunk-dark',
                        },
                        {
                            label: t('settings.appearance.colorTheme.options.mixer', 'Mixer3D'),
                            value: 'mixer-dark',
                        },
                        {
                            label: t(
                                'settings.appearance.colorTheme.options.notreal',
                                'NotRealEngine'
                            ),
                            value: 'notreal-dark',
                        },
                        {
                            label: t('settings.appearance.colorTheme.options.comfort', 'ComfortUI'),
                            value: 'comfort-dark',
                        },
                    ],
                    small: true,
                }}
                value={theme}
            />

            <DropdownSetting
                setValue={(value) => setLanguage(value)}
                setting={{
                    label: t('settings.appearance.language.label', 'Language'),
                    description: t(
                        'settings.appearance.language.description',
                        "Choose the language for chaiNNer's interface."
                    ),
                    options: [
                        { label: t('languages.english', 'English'), value: 'en' },
                        { label: t('languages.spanish', 'Español'), value: 'es' },
                        { label: t('languages.german', 'Deutsch'), value: 'de' },
                    ],
                    small: true,
                }}
                value={language}
            />

            <ToggleSetting
                setValue={setAnimateChain}
                setting={{
                    label: t('settings.appearance.chainAnimation.label', 'Chain animation'),
                    description: t(
                        'settings.appearance.chainAnimation.description',
                        'Enable animations that show the processing state of the chain.'
                    ),
                }}
                value={animateChain}
            />

            <ToggleSetting
                setValue={setShowMinimap}
                setting={{
                    label: t('settings.appearance.minimap.label', 'Minimap'),
                    description: t(
                        'settings.appearance.minimap.description',
                        'Enable a minimap of the current chain in the bottom right corner of the node editor.'
                    ),
                }}
                value={showMinimap}
            />

            <ToggleSetting
                setValue={setSnapToGrid}
                setting={{
                    label: t('settings.appearance.snapToGrid.label', 'Snap to grid'),
                    description: t(
                        'settings.appearance.snapToGrid.description',
                        'Enable node grid snapping.'
                    ),
                }}
                value={snapToGrid}
            />

            <NumberSetting
                setValue={setSnapToGridAmount}
                setting={{
                    label: t('settings.appearance.snapToGridAmount.label', 'Snap to grid amount'),
                    description: t(
                        'settings.appearance.snapToGridAmount.description',
                        'The amount to snap the grid to.'
                    ),
                    max: 45,
                    min: 1,
                }}
                value={snapToGridAmount}
            />

            <NumberSetting
                setValue={setViewportExportPadding}
                setting={{
                    label: t(
                        'settings.appearance.viewportExportPadding.label',
                        'Viewport PNG export padding'
                    ),
                    description: t(
                        'settings.appearance.viewportExportPadding.description',
                        'The amount of padding for the viewport PNG export.'
                    ),
                    max: 100,
                    min: 0,
                }}
                value={viewportExportPadding}
            />
        </VStack>
    );
});

const EnvironmentSettings = memo(() => {
    const { t } = useTranslation();
    const [startupTemplate, setStartupTemplate] = useMutSetting('startupTemplate');

    const [lastDirectory, setLastDirectory] = useState(startupTemplate || '');

    const onButtonClick = useCallback(async () => {
        const fileDir = startupTemplate ? path.dirname(startupTemplate) : lastDirectory;
        const fileFilter = [
            {
                name: t('settings.environment.selectChain', 'Select Chain'),
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
    }, [startupTemplate, lastDirectory, setStartupTemplate, t]);

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <SettingContainer
                description={t(
                    'settings.environment.startupTemplate.description',
                    'Set a chain template to use by default when chaiNNer starts up.'
                )}
                title={t('settings.environment.startupTemplate.label', 'Startup Template')}
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
                                alt={t(
                                    'settings.environment.startupTemplate.pickFile',
                                    'Pick startup template file'
                                )}
                                className="nodrag"
                                cursor="pointer"
                                draggable={false}
                                placeholder={t(
                                    'settings.environment.startupTemplate.placeholder',
                                    'Select a file...'
                                )}
                                textOverflow="ellipsis"
                                value={startupTemplate ? path.parse(startupTemplate).base : ''}
                                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                                onClick={onButtonClick}
                            />
                        </InputGroup>
                    </Tooltip>
                    <IconButton
                        aria-label={t('settings.environment.startupTemplate.clear', 'Clear')}
                        icon={<SmallCloseIcon />}
                        size="xs"
                        onClick={() => setStartupTemplate('')}
                    />
                </HStack>
            </SettingContainer>
        </VStack>
    );
});

const PythonSettings = memo(() => {
    const { t } = useTranslation();
    const { packages } = useContext(BackendContext);
    const [packageSettings, setPackageSettings] = useMutSetting('packageSettings');

    const [useSystemPython, setUseSystemPython] = useMutSetting('useSystemPython');
    const [systemPythonLocation, setSystemPythonLocation] = useMutSetting('systemPythonLocation');
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
                        <Text cursor="pointer">{t('settings.python.general', 'General')}</Text>
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
                            setValue={setUseSystemPython}
                            setting={{
                                label: t(
                                    'settings.python.useSystemPython.label',
                                    'Use system Python (requires restart)'
                                ),
                                description: t(
                                    'settings.python.useSystemPython.description',
                                    "Use system Python for chaiNNer's processing instead of the bundled Python (not recommended)"
                                ),
                            }}
                            value={useSystemPython}
                        />
                        {useSystemPython && (
                            <SettingContainer
                                description={t(
                                    'settings.python.systemPythonLocation.description',
                                    "If wanted, use a specific python binary rather than the default one invoked by 'python3' or 'python'. This is useful if you have multiple python versions installed and want to pick a specific one."
                                )}
                                title={t(
                                    'settings.python.systemPythonLocation.label',
                                    'System Python location (optional)'
                                )}
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
                                                alt={t(
                                                    'settings.python.systemPythonLocation.pickFile',
                                                    'Pick system python location'
                                                )}
                                                className="nodrag"
                                                cursor="pointer"
                                                draggable={false}
                                                placeholder={t(
                                                    'settings.python.systemPythonLocation.placeholder',
                                                    'Select a file...'
                                                )}
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
                                        aria-label={t(
                                            'settings.python.systemPythonLocation.clear',
                                            'Clear'
                                        )}
                                        icon={<SmallCloseIcon />}
                                        size="xs"
                                        onClick={() => setSystemPythonLocation('')}
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
                                const thisSetting = packageSettings[pkg.id]?.[setting.key];
                                return (
                                    <SettingItem
                                        key={setting.key}
                                        setValue={(value) => {
                                            setPackageSettings((prev) => {
                                                return {
                                                    ...prev,
                                                    [pkg.id]: {
                                                        ...(prev[pkg.id] ?? {}),
                                                        [setting.key]: value,
                                                    },
                                                };
                                            });
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
    const { t } = useTranslation();
    const [checkForUpdatesOnStartup, setCheckForUpdatesOnStartup] = useMutSetting(
        'checkForUpdatesOnStartup'
    );
    const [experimentalFeatures, setExperimentalFeatures] = useMutSetting('experimentalFeatures');
    const [hardwareAcceleration, setHardwareAcceleration] = useMutSetting('hardwareAcceleration');
    const [allowMultipleInstances, setAllowMultipleInstances] =
        useMutSetting('allowMultipleInstances');

    return (
        <VStack
            divider={<StackDivider />}
            w="full"
        >
            <ToggleSetting
                setValue={setCheckForUpdatesOnStartup}
                setting={{
                    label: t(
                        'settings.advanced.checkForUpdates.label',
                        'Check for Update on Start-up'
                    ),
                    description: t(
                        'settings.advanced.checkForUpdates.description',
                        'Toggles checking for updates on start-up.'
                    ),
                }}
                value={checkForUpdatesOnStartup}
            />
            <ToggleSetting
                setValue={setExperimentalFeatures}
                setting={{
                    label: t(
                        'settings.advanced.experimentalFeatures.label',
                        'Enable experimental features'
                    ),
                    description: t(
                        'settings.advanced.experimentalFeatures.description',
                        'Enable experimental features to try them out before they are finished.'
                    ),
                }}
                value={experimentalFeatures}
            />
            <ToggleSetting
                setValue={setHardwareAcceleration}
                setting={{
                    label: t(
                        'settings.advanced.hardwareAcceleration.label',
                        'Enable Hardware Acceleration (requires restart)'
                    ),
                    description: t(
                        'settings.advanced.hardwareAcceleration.description',
                        'Enable GPU rendering for the GUI. Use with caution, as it may severely decrease GPU performance for image processing.'
                    ),
                }}
                value={hardwareAcceleration}
            />
            {/* TODO: Not working on macOS ATM. A new window must be created. */}
            {!isMac && (
                <ToggleSetting
                    setValue={setAllowMultipleInstances}
                    setting={{
                        label: t(
                            'settings.advanced.allowMultipleInstances.label',
                            'Allow multiple concurrent instances'
                        ),
                        description: t(
                            'settings.advanced.allowMultipleInstances.description',
                            'Enable multiple concurrent instances of chaiNNer. This is not recommended, but if your chain is not using enough of your system resources, you might find this helpful for running things concurrently.'
                        ),
                    }}
                    value={allowMultipleInstances}
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
    const { t } = useTranslation();
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
                <ModalHeader>{t('settings.title', 'Settings')}</ModalHeader>
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
                                    <Text cursor="pointer">
                                        {t('settings.tabs.appearance', 'Appearance')}
                                    </Text>
                                </HStack>
                            </Tab>
                            <Tab>
                                <HStack cursor="pointer">
                                    <Icon as={BsFillPencilFill} />
                                    <Text cursor="pointer">
                                        {t('settings.tabs.environment', 'Environment')}
                                    </Text>
                                </HStack>
                            </Tab>
                            <Tab>
                                <HStack cursor="pointer">
                                    <Icon as={FaPython} />
                                    <Text cursor="pointer">
                                        {t('settings.tabs.python', 'Python')}
                                    </Text>
                                </HStack>
                            </Tab>
                            <Tab>
                                <HStack cursor="pointer">
                                    <Icon as={FaTools} />
                                    <Text cursor="pointer">
                                        {t('settings.tabs.advanced', 'Advanced')}
                                    </Text>
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
                            {t('settings.restartChaiNNer', 'Restart chaiNNer')}
                        </Button>
                        <Button
                            colorScheme="blue"
                            mr={3}
                            onClick={onClose}
                        >
                            {t('common.close', 'Close')}
                        </Button>
                    </HStack>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
});

export const SettingsButton = memo(() => {
    const { t } = useTranslation();
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
                label={t('common.settings', 'Settings')}
                px={2}
                py={1}
            >
                <IconButton
                    aria-label={t('common.settings', 'Settings')}
                    icon={<SettingsIcon />}
                    size="md"
                    variant="outline"
                    onClick={onSettingsOpen}
                >
                    {t('common.settings', 'Settings')}
                </IconButton>
            </Tooltip>
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={onSettingsClose}
            />
        </>
    );
});
