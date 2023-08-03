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
    Progress,
    Spacer,
    Spinner,
    Switch,
    Tag,
    Text,
    Textarea,
    Tooltip,
    VStack,
    useDisclosure,
} from '@chakra-ui/react';
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
import { isArmMac } from '../../common/env';
import { log } from '../../common/log';
import { OnStdio, runPipInstall, runPipUninstall } from '../../common/pip';
import { noop } from '../../common/util';
import { versionGt } from '../../common/version';
import { Markdown } from '../components/Markdown';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import { useMemoObject } from '../hooks/useMemo';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { GlobalContext } from './GlobalNodeState';
import { SettingsContext } from './SettingsContext';

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
                                        borderRadius={8}
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
    const { useIsSystemPython } = useContext(SettingsContext);
    const { backend, pythonInfo, restart, packages, featureStates, refreshFeatureStates } =
        useContext(BackendContext);
    const { hasRelevantUnsavedChangesRef } = useContext(GlobalContext);

    const [isSystemPython] = useIsSystemPython;

    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [usePipDirectly, setUsePipDirectly] = useState(false);

    const [hasNvidia, setHasNvidia] = useState(false);
    useAsyncEffect(
        () => ({
            supplier: async () => (await backend.listNvidiaGpus()).length > 0,
            successEffect: setHasNvidia,
        }),
        [backend]
    );

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

    const installPackage = (p: Package) => {
        setInstallingPackage(p);
        changePackages(() =>
            runPipInstall(
                pythonInfo,
                p.dependencies,
                usePipDirectly ? undefined : setProgress,
                onStdio
            )
        );
    };

    const uninstallPackage = (p: Package) => {
        setUninstallingPackage(p);
        changePackages(() =>
            runPipUninstall(
                pythonInfo,
                p.dependencies,
                usePipDirectly ? undefined : setProgress,
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
                onClose={onClose}
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
                            {!isArmMac && (
                                <Flex w="full">
                                    <Text
                                        flex="1"
                                        textAlign="left"
                                    >
                                        {hasNvidia ? 'CUDA supported' : 'CUDA not supported'}
                                    </Text>
                                </Flex>
                            )}
                            <Flex
                                align="center"
                                w="full"
                            >
                                <Text
                                    flex="1"
                                    textAlign="left"
                                >
                                    Python ({pythonInfo.version}) [
                                    {isSystemPython ? 'System' : 'Integrated'}]
                                </Text>
                                <HStack>
                                    <HStack>
                                        <Switch
                                            isChecked={usePipDirectly}
                                            isDisabled={isRunningShell}
                                            onChange={() => {
                                                setUsePipDirectly(!usePipDirectly);
                                            }}
                                        />
                                        <Text>Use Pip Directly</Text>
                                        <Tooltip
                                            hasArrow
                                            borderRadius={8}
                                            label="Disable progress bars and use pip to directly download and install the packages. Use this setting if you are having issues installing normally."
                                            maxW="auto"
                                            openDelay={500}
                                            px={2}
                                            py={0}
                                        >
                                            <Center>
                                                <Icon as={BsQuestionCircle} />
                                            </Center>
                                        </Tooltip>
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
                                                    !usePipDirectly &&
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
                            <Divider w="full" />
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
                                        leftIcon={<HiOutlineRefresh />}
                                        size="sm"
                                        onClick={refreshFeatureStates}
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
