import { DeleteIcon, DownloadIcon, InfoIcon } from '@chakra-ui/icons';
import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Box,
    Button,
    Center,
    Collapse,
    Divider,
    Flex,
    HStack,
    Icon,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverCloseButton,
    PopoverContent,
    PopoverHeader,
    PopoverTrigger,
    Progress,
    Select,
    Spacer,
    Spinner,
    Tag,
    Text,
    Textarea,
    Tooltip,
    VStack,
    useDisclosure,
} from '@chakra-ui/react';
import { clipboard } from 'electron';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BsQuestionCircle, BsTerminalFill } from 'react-icons/bs';
import { HiOutlineRefresh } from 'react-icons/hi';
import { useQuery } from 'react-query';
import { createContext, useContext } from 'use-context-selector';
import {
    Feature,
    FeatureId,
    FeatureState,
    Package,
    PyPiName,
    PyPiPackage,
    Version,
} from '../../common/common-types';
import { log } from '../../common/log';
import { OnStdio, getFindLinks, runPipInstall, runPipUninstall } from '../../common/pip';
import { noop } from '../../common/util';
import { versionGt } from '../../common/version';
import { Markdown } from '../components/Markdown';
import { useMemoObject } from '../hooks/useMemo';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { GlobalContext } from './GlobalNodeState';
import { useSettings } from './SettingsContext';

const installModes = {
    NORMAL: 'Normal',
    DIRECT_PIP: 'Direct Pip',
    MANUAL_COPY: 'Manual/Copy',
};

export interface DependencyContextValue {
    openDependencyManager: () => void;
    availableUpdates: number;
}

export const DependencyContext = createContext<Readonly<DependencyContextValue>>({
    openDependencyManager: noop,
    availableUpdates: 0,
});

const formatBytes = (bytes: number): string => {
    const KB = 1024 ** 1;
    const MB = 1024 ** 2;
    const GB = 1024 ** 3;

    if (bytes < KB) return `${bytes}\u2009Byte`;
    if (bytes < MB) return `${Number((bytes / KB).toPrecision(2))}\u2009KB`;
    if (bytes < GB) return `${Number((bytes / MB).toPrecision(2))}\u2009MB`;
    return `${Number((bytes / GB).toPrecision(2))}\u2009GB`;
};
const formatSizeEstimate = (packages: readonly PyPiPackage[]): string =>
    formatBytes(packages.reduce((a, p) => a + p.sizeEstimate, 0));

const PackageDependencyView = memo(
    ({ pkg, installedVersion }: { pkg: PyPiPackage; installedVersion: Version | null }) => {
        let color = 'red.500';
        let tagText = 'Missing';
        let versionString: string = pkg.version;
        if (installedVersion) {
            const outdated = versionGt(pkg.version, installedVersion);
            if (outdated) {
                color = 'yellow.500';
                tagText = 'Outdated';
                versionString = `${installedVersion} → ${pkg.version}`;
            } else {
                color = 'inherit';
                tagText = '';
            }
        }
        return (
            <HStack
                align="center"
                key={pkg.pypiName}
                w="full"
            >
                <Text
                    color={color}
                    textAlign="left"
                    width="fit-content"
                >
                    {pkg.pypiName}
                </Text>
                {!!tagText && <Tag color={color}>{tagText}</Tag>}
                <Tag>{versionString}</Tag>
                <Spacer />
            </HStack>
        );
    }
);

const PackageView = memo(
    ({
        p,
        isRunningShell,
        progress,
        installedPyPi,
        onInstall,
        onUninstall,
        onUpdate,
    }: {
        p: Package;
        isRunningShell: boolean;
        progress?: number;
        installedPyPi: Readonly<Partial<Record<PyPiName, Version>>>;
        onInstall: () => void;
        onUninstall: () => void;
        onUpdate: () => void;
    }) => {
        const missingPackages = p.dependencies.filter((d) => !installedPyPi[d.pypiName]);
        const outdatedPackages = p.dependencies.filter((d) => {
            const installed = installedPyPi[d.pypiName];
            return installed && versionGt(d.version, installed);
        });

        return (
            <AccordionItem cursor="pointer">
                <h2>
                    <VStack
                        spacing={0}
                        w="full"
                    >
                        <HStack w="full">
                            <AccordionButton cursor="pointer">
                                <HStack
                                    cursor="pointer"
                                    spacing={1}
                                    w="full"
                                >
                                    <Text
                                        cursor="pointer"
                                        flex="1"
                                        textAlign="left"
                                        w="full"
                                    >
                                        {p.name} ({p.dependencies.length} package
                                        {p.dependencies.length === 1 ? '' : 's'})
                                    </Text>
                                    <Tooltip
                                        closeOnClick
                                        closeOnMouseDown
                                        hasArrow
                                        borderRadius={8}
                                        css={{
                                            textAlign: 'justify',
                                            hyphens: 'auto',
                                            whiteSpace: 'pre-line',
                                        }}
                                        label={p.description}
                                        px={2}
                                        py={1}
                                    >
                                        <InfoIcon />
                                    </Tooltip>
                                </HStack>
                            </AccordionButton>
                            {missingPackages.length === 0 ? (
                                <HStack
                                    mr={1}
                                    py={2}
                                >
                                    {outdatedPackages.length > 0 && (
                                        <Button
                                            colorScheme="blue"
                                            disabled={isRunningShell}
                                            isLoading={isRunningShell}
                                            leftIcon={<DownloadIcon />}
                                            size="sm"
                                            onClick={onUpdate}
                                        >
                                            Update ({formatSizeEstimate(outdatedPackages)})
                                        </Button>
                                    )}

                                    <Button
                                        colorScheme="red"
                                        disabled={isRunningShell}
                                        leftIcon={<DeleteIcon />}
                                        size="sm"
                                        onClick={onUninstall}
                                    >
                                        Uninstall
                                    </Button>
                                </HStack>
                            ) : (
                                <HStack
                                    mr={1}
                                    py={2}
                                >
                                    <Button
                                        colorScheme="blue"
                                        disabled={isRunningShell}
                                        isLoading={isRunningShell}
                                        leftIcon={<DownloadIcon />}
                                        size="sm"
                                        onClick={onInstall}
                                    >
                                        Install (
                                        {formatSizeEstimate([
                                            ...missingPackages,
                                            ...outdatedPackages,
                                        ])}
                                        )
                                    </Button>
                                </HStack>
                            )}
                            <AccordionButton
                                cursor="pointer"
                                w={4}
                            >
                                <Center
                                    cursor="pointer"
                                    w="full"
                                >
                                    <AccordionIcon />
                                </Center>
                            </AccordionButton>
                        </HStack>
                        {progress !== undefined && (
                            <Center
                                cursor="pointer"
                                h={8}
                                w="full"
                            >
                                <Progress
                                    hasStripe
                                    isAnimated
                                    cursor="pointer"
                                    value={progress}
                                    w="full"
                                />
                            </Center>
                        )}
                    </VStack>
                </h2>
                <AccordionPanel pb={4}>
                    <VStack
                        key={p.id}
                        w="full"
                    >
                        {p.dependencies.map((d) => (
                            <PackageDependencyView
                                installedVersion={installedPyPi[d.pypiName] ?? null}
                                key={d.pypiName}
                                pkg={d}
                            />
                        ))}
                    </VStack>
                </AccordionPanel>
            </AccordionItem>
        );
    }
);

interface FeaturesAccordionProps {
    features: readonly Feature[];
    featureStates: ReadonlyMap<FeatureId, FeatureState>;
}
const FeaturesAccordion = memo(({ features, featureStates }: FeaturesAccordionProps) => {
    return (
        <Accordion
            allowToggle
            w="full"
        >
            {features.map((f) => {
                const state = featureStates.get(f.id);

                let stateLabel;
                let stateColor;
                if (state === undefined) {
                    stateLabel = 'Unavailable';
                    stateColor = 'gray.500';
                } else if (state.enabled) {
                    stateLabel = 'Enabled';
                    stateColor = 'green.500';
                } else {
                    stateLabel = 'Disabled';
                    stateColor = 'gray.500';
                }

                return (
                    <AccordionItem
                        cursor="pointer"
                        key={f.id}
                    >
                        <h2>
                            <HStack w="full">
                                <AccordionButton
                                    cursor="pointer"
                                    pr={0}
                                >
                                    <HStack
                                        cursor="pointer"
                                        spacing={1}
                                        w="full"
                                    >
                                        <Text
                                            cursor="pointer"
                                            flex="1"
                                            textAlign="left"
                                            w="full"
                                        >
                                            {f.name}
                                        </Text>
                                        <Tooltip
                                            closeOnClick
                                            borderRadius={8}
                                            label={state?.details ?? 'NO DETAILS'}
                                            px={2}
                                            py={1}
                                        >
                                            <InfoIcon />
                                        </Tooltip>
                                        <Text
                                            color={stateColor}
                                            cursor="pointer"
                                            pl={4}
                                        >
                                            {stateLabel}
                                        </Text>
                                    </HStack>
                                </AccordionButton>
                                <AccordionButton
                                    cursor="pointer"
                                    w={4}
                                >
                                    <Center
                                        cursor="pointer"
                                        w="full"
                                    >
                                        <AccordionIcon />
                                    </Center>
                                </AccordionButton>
                            </HStack>
                        </h2>
                        <AccordionPanel pb={4}>
                            <Markdown>{f.description}</Markdown>
                        </AccordionPanel>
                    </AccordionItem>
                );
            })}
        </Accordion>
    );
});

export const DependencyProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    const { showAlert } = useContext(AlertBoxContext);
    const { useSystemPython } = useSettings();
    const { backend, pythonInfo, restart, packages, featureStates, refreshFeatureStates } =
        useContext(BackendContext);
    const { hasRelevantUnsavedChangesRef } = useContext(GlobalContext);

    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [installMode, setInstallMode] = useState(installModes.NORMAL);

    const { data: installedPyPi, refetch: refetchInstalledPyPi } = useQuery({
        queryKey: 'dependencies',
        queryFn: async () => {
            try {
                return await backend.installedDependencies();
            } catch (error) {
                log.error(error);
                throw error;
            }
        },
        cacheTime: 0,
        retry: 25,
        refetchOnWindowFocus: false,
        refetchInterval: false,
    });

    const [installingPackage, setInstallingPackage] = useState<Package | null>(null);
    const [uninstallingPackage, setUninstallingPackage] = useState<Package | null>(null);

    const consoleRef = useRef<HTMLTextAreaElement | null>(null);
    const [shellOutput, setShellOutput] = useState('');
    const [isRunningShell, setIsRunningShell] = useState(false);
    const [progress, setProgress] = useState(0);
    const appendToOutput = useCallback(
        (data: string) => {
            setShellOutput((prev) => (prev + data).slice(-10_000));
        },
        [setShellOutput]
    );
    const onStdio: OnStdio = { onStderr: appendToOutput, onStdout: appendToOutput };

    const changePackages = (supplier: () => Promise<void>) => {
        if (isRunningShell) throw new Error('Cannot run two pip commands at once');

        setShellOutput('');
        setIsRunningShell(true);
        setProgress(0);

        supplier()
            .catch((error) => {
                appendToOutput(`${String(error)}\n`);
            })
            .finally(() => {
                restart()
                    .catch(log.error)
                    .then(() => {
                        refetchInstalledPyPi()
                            .catch(log.error)
                            .then(() => {
                                setIsRunningShell(false);
                                setInstallingPackage(null);
                                setUninstallingPackage(null);
                                setProgress(0);
                            })
                            .catch(log.error);
                    })
                    .catch(log.error);
            });
    };

    const {
        isOpen: isPopoverOpen,
        onToggle: onPopoverToggle,
        onClose: onPopoverClose,
    } = useDisclosure();
    const copyCommandToClipboard = (command: string) => {
        clipboard.writeText(command);
        onPopoverToggle();
        setTimeout(() => {
            onPopoverClose();
        }, 5000);
    };

    const installPackage = (pkg: Package) => {
        if (installMode === installModes.MANUAL_COPY) {
            const deps = pkg.dependencies.map((p) => `${p.pypiName}==${p.version}`);
            const findLinks = getFindLinks(pkg.dependencies).flatMap((l) => [
                '--extra-index-url',
                l,
            ]);
            const args = [
                pythonInfo.python,
                '-m',
                'pip',
                'install',
                '--upgrade',
                ...deps,
                ...findLinks,
            ];
            const cmd = args.join(' ');
            copyCommandToClipboard(cmd);
            return;
        }
        setInstallingPackage(pkg);
        changePackages(() =>
            runPipInstall(
                pythonInfo,
                pkg.dependencies,
                installMode === installModes.NORMAL ? setProgress : undefined,
                onStdio
            )
        );
    };

    const uninstallPackage = (pkg: Package) => {
        if (installMode === installModes.MANUAL_COPY) {
            const deps = pkg.dependencies.map((p) => p.pypiName);
            const args = [pythonInfo.python, '-m', 'pip', 'uninstall', ...deps];
            const cmd = args.join(' ');
            copyCommandToClipboard(cmd);
            return;
        }
        setUninstallingPackage(pkg);
        changePackages(() =>
            runPipUninstall(
                pythonInfo,
                pkg.dependencies,
                installMode === installModes.NORMAL ? setProgress : undefined,
                onStdio
            )
        );
    };

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [shellOutput]);

    // whether we are current installing/uninstalling packages or refreshing the list pf installed packages
    const currentlyProcessingDeps =
        installedPyPi === undefined || installingPackage !== null || uninstallingPackage !== null;

    const availableUpdates = useMemo((): number => {
        if (!installedPyPi) return 0;
        return packages.filter(({ dependencies }) =>
            dependencies.some(({ version, pypiName }) => {
                const installed = installedPyPi[pypiName];
                if (!installed) {
                    return true;
                }
                return versionGt(version, installed);
            })
        ).length;
    }, [packages, installedPyPi]);

    const value = useMemoObject<DependencyContextValue>({
        openDependencyManager: onOpen,
        availableUpdates,
    });

    const features = useMemo(() => packages.flatMap((p) => p.features), [packages]);
    const [isRefreshingFeatureStates, setIsRefreshingFeatureStates] = useState(false);

    return (
        <DependencyContext.Provider value={value}>
            {children}
            <Modal
                isCentered
                closeOnOverlayClick={!currentlyProcessingDeps}
                isOpen={isOpen}
                returnFocusOnClose={false}
                scrollBehavior="inside"
                size="xl"
                onClose={currentlyProcessingDeps ? noop : onClose}
            >
                <ModalOverlay />
                <ModalContent
                    bgColor="var(--chain-editor-bg)"
                    maxW="750px"
                >
                    <ModalHeader>Dependency Manager</ModalHeader>
                    <ModalCloseButton disabled={currentlyProcessingDeps} />
                    <ModalBody>
                        <VStack w="full">
                            <Flex
                                align="center"
                                w="full"
                            >
                                <Text
                                    flex="1"
                                    textAlign="left"
                                >
                                    Python ({pythonInfo.version}) [
                                    {useSystemPython ? 'System' : 'Integrated'}]
                                </Text>
                                <HStack gap={2}>
                                    <HStack>
                                        <HStack>
                                            <Popover
                                                closeOnBlur={false}
                                                colorScheme="green"
                                                isOpen={isPopoverOpen}
                                                placement="top"
                                                returnFocusOnClose={false}
                                                onClose={onPopoverClose}
                                            >
                                                <PopoverTrigger>
                                                    <Select
                                                        isDisabled={isRunningShell}
                                                        size="md"
                                                        value={installMode}
                                                        onChange={(e) => {
                                                            setInstallMode(e.target.value);
                                                        }}
                                                    >
                                                        <option>{installModes.NORMAL}</option>
                                                        <option>{installModes.DIRECT_PIP}</option>
                                                        <option>{installModes.MANUAL_COPY}</option>
                                                    </Select>
                                                </PopoverTrigger>
                                                <PopoverContent>
                                                    <PopoverHeader fontWeight="semibold">
                                                        Command copied to clipboard.
                                                    </PopoverHeader>
                                                    <PopoverArrow />
                                                    <PopoverCloseButton />
                                                    <PopoverBody>
                                                        Open up an external terminal, paste the
                                                        command, and run it. When it is done
                                                        running, manually restart chaiNNer.
                                                    </PopoverBody>
                                                </PopoverContent>
                                            </Popover>

                                            <Tooltip
                                                hasArrow
                                                borderRadius={8}
                                                label={
                                                    <Markdown nonInteractive>
                                                        {'The dependency install mode. ChaiNNer supports 3 ways of installing packages:\n\n' +
                                                            '- Normal: This is the default installation mode. This mode manually downloads packages in order to display download progress.\n' +
                                                            '- Direct Pip: This will invoke pip more directly, like installing python packages normally. Use this setting when having issues with Normal. Note: this makes it impossible to show installation progress.\n' +
                                                            '- Manual/Copy: Copy the pip install command to your clipboard for you to run in your own terminal. You will have to manually restart chaiNner afterwards.'}
                                                    </Markdown>
                                                }
                                                openDelay={500}
                                                px={2}
                                                py={0}
                                            >
                                                <Center>
                                                    <Icon as={BsQuestionCircle} />
                                                </Center>
                                            </Tooltip>
                                        </HStack>
                                    </HStack>
                                    <Button
                                        aria-label={isConsoleOpen ? 'Hide Console' : 'View Console'}
                                        leftIcon={<BsTerminalFill />}
                                        size="sm"
                                        onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                                    >
                                        {isConsoleOpen ? 'Hide Console' : 'View Console'}
                                    </Button>
                                </HStack>
                            </Flex>
                            {!installedPyPi ? (
                                <Spinner />
                            ) : (
                                <Accordion
                                    allowToggle
                                    // allowMultiple={false}
                                    w="full"
                                >
                                    {packages.map((p) => {
                                        if (p.dependencies.length === 0) {
                                            return null;
                                        }

                                        const install = () => installPackage(p);
                                        const uninstall = () => {
                                            showAlert({
                                                type: AlertType.WARN,
                                                title: 'Uninstall',
                                                message: `Are you sure you want to uninstall ${p.name}?`,
                                                buttons: ['Cancel', 'Uninstall'],
                                                defaultId: 0,
                                            })
                                                .then(async (button) => {
                                                    if (button === 0) return;

                                                    if (hasRelevantUnsavedChangesRef.current) {
                                                        const saveButton = await showAlert({
                                                            type: AlertType.WARN,
                                                            title: 'Unsaved Changes',
                                                            message:
                                                                `You might lose your unsaved changes by uninstalling ${p.name}.` +
                                                                `\n\nAre you sure you want to uninstall ${p.name}?`,
                                                            buttons: ['Cancel', 'Uninstall'],
                                                            defaultId: 0,
                                                        });
                                                        if (saveButton === 0) return;
                                                    }

                                                    uninstallPackage(p);
                                                })
                                                .catch(log.error);
                                        };

                                        return (
                                            <PackageView
                                                installedPyPi={installedPyPi}
                                                isRunningShell={isRunningShell}
                                                key={p.id}
                                                p={p}
                                                progress={
                                                    installMode === installModes.NORMAL &&
                                                    isRunningShell &&
                                                    (installingPackage || uninstallingPackage)
                                                        ?.id === p.id
                                                        ? progress
                                                        : undefined
                                                }
                                                onInstall={install}
                                                onUninstall={uninstall}
                                                onUpdate={install}
                                            />
                                        );
                                    })}
                                </Accordion>
                            )}
                            <Center
                                animateOpacity
                                as={Collapse}
                                in={isConsoleOpen}
                                w="full"
                            >
                                {/* <Collapse
                                    animateOpacity
                                    in={isConsoleOpen}
                                > */}
                                <Center w="full">
                                    <Textarea
                                        readOnly
                                        cursor="default"
                                        fontFamily="monospace"
                                        h="150"
                                        overflowY="scroll"
                                        placeholder=""
                                        ref={consoleRef}
                                        sx={{
                                            '&::-webkit-scrollbar': {
                                                width: '8px',
                                                borderRadius: '8px',
                                                backgroundColor: 'rgba(0, 0, 0, 0)',
                                            },
                                            '&::-webkit-scrollbar-track': {
                                                borderRadius: '8px',
                                                width: '8px',
                                            },
                                            '&::-webkit-scrollbar-thumb': {
                                                borderRadius: '8px',
                                                backgroundColor: 'var(--bg-600)',
                                            },
                                        }}
                                        value={shellOutput}
                                        w="full"
                                        onChange={(e) => e.preventDefault()}
                                        onClick={(e) => e.preventDefault()}
                                        onFocus={(e) => e.preventDefault()}
                                    />
                                </Center>
                                {/* </Collapse> */}
                            </Center>
                            {isConsoleOpen && <Divider w="full" />}
                            <Box w="full">
                                <Flex
                                    mb={2}
                                    mt={2}
                                >
                                    <Text
                                        flex="1"
                                        fontWeight="bold"
                                    >
                                        Features
                                    </Text>
                                    <Button
                                        isDisabled={currentlyProcessingDeps}
                                        leftIcon={
                                            isRefreshingFeatureStates ? (
                                                <Spinner
                                                    height="1em"
                                                    size="sm"
                                                    width="1em"
                                                />
                                            ) : (
                                                <HiOutlineRefresh
                                                    height="1em"
                                                    width="1em"
                                                />
                                            )
                                        }
                                        size="sm"
                                        onClick={() => {
                                            if (isRefreshingFeatureStates) return;
                                            setIsRefreshingFeatureStates(true);
                                            refreshFeatureStates()
                                                .finally(() => {
                                                    setIsRefreshingFeatureStates(false);
                                                })
                                                .catch(log.error);
                                        }}
                                    >
                                        Refresh
                                    </Button>
                                </Flex>
                                <FeaturesAccordion
                                    featureStates={featureStates}
                                    features={features}
                                />
                            </Box>
                        </VStack>
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            colorScheme="blue"
                            disabled={currentlyProcessingDeps}
                            mr={3}
                            variant={currentlyProcessingDeps ? 'ghost' : 'solid'}
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </DependencyContext.Provider>
    );
});
