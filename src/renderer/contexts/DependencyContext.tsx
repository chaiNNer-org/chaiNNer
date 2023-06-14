import { DeleteIcon, DownloadIcon, InfoIcon } from '@chakra-ui/icons';
import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
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
import { createContext, useContext } from 'use-context-selector';
import { Version } from '../../common/common-types';
import { Package, PyPiPackage } from '../../common/dependencies';
import { Integration, externalIntegrations } from '../../common/externalIntegrations';
import { log } from '../../common/log';
import { OnStdio, PipList, runPipInstall, runPipList, runPipUninstall } from '../../common/pip';
import { ipcRenderer } from '../../common/safeIpc';
import { noop } from '../../common/util';
import { versionGt } from '../../common/version';
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

export interface ExternalIntegrationConnectionStatus {
    integration: Integration;
    connected: boolean;
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

const FeaturePackage = memo(
    ({ pkg, installedVersion }: { pkg: PyPiPackage; installedVersion?: Version }) => {
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

const Feature = memo(
    ({
        dep,
        pipList,
        isRunningShell,
        progress,
        onInstall,
        onUninstall,
        onUpdate,
    }: {
        dep: Package;
        pipList: PipList;
        isRunningShell: boolean;
        progress?: number;
        onInstall: () => void;
        onUninstall: () => void;
        onUpdate: () => void;
    }) => {
        const missingPackages = dep.dependencies.filter((p) => !pipList[p.pypiName]);
        const outdatedPackages = dep.dependencies.filter((p) => {
            const installedVersion = pipList[p.pypiName];
            return installedVersion && versionGt(p.version, installedVersion);
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
                                        {dep.name} ({dep.dependencies.length} package
                                        {dep.dependencies.length === 1 ? '' : 's'})
                                    </Text>
                                    <Tooltip
                                        closeOnClick
                                        closeOnMouseDown
                                        borderRadius={8}
                                        label={dep.description}
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
                        key={dep.name}
                        w="full"
                    >
                        {dep.dependencies.map((p) => (
                            <FeaturePackage
                                installedVersion={pipList[p.pypiName]}
                                key={p.pypiName}
                                pkg={p}
                            />
                        ))}
                    </VStack>
                </AccordionPanel>
            </AccordionItem>
        );
    }
);

export const DependencyProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    const { showAlert } = useContext(AlertBoxContext);
    const { useIsSystemPython } = useContext(SettingsContext);
    const { backend, pythonInfo, restart } = useContext(BackendContext);
    const { hasRelevantUnsavedChangesRef } = useContext(GlobalContext);

    const [isSystemPython] = useIsSystemPython;

    const [pipList, setPipList] = useState<PipList>();
    const refreshInstalledPackages = useCallback(() => setPipList(undefined), [setPipList]);

    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [usePipDirectly, setUsePipDirectly] = useState(false);

    useAsyncEffect(() => {
        if (pipList) return;
        return {
            supplier: () => runPipList(pythonInfo),
            successEffect: setPipList,
        };
    }, [pythonInfo, pipList, setPipList]);

    const [hasNvidia, setHasNvidia] = useState(false);
    useAsyncEffect(
        () => ({
            supplier: async () => !!(await ipcRenderer.invoke('get-nvidia-gpu-name')),
            successEffect: setHasNvidia,
        }),
        []
    );

    const [availableDeps, setAvailableDeps] = useState<Package[]>([]);
    useAsyncEffect(
        () => ({
            supplier: async () => {
                const res = await backend.dependencies();
                return res.filter((d) => d.dependencies.length > 0);
            },
            successEffect: setAvailableDeps,
        }),
        [backend]
    );

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
                setIsRunningShell(false);
                refreshInstalledPackages();
                setInstallingPackage(null);
                setUninstallingPackage(null);
                setProgress(0);
                restart().catch(log.error);
            });
    };

    const installPackage = (dep: Package) => {
        setInstallingPackage(dep);
        changePackages(() =>
            runPipInstall(pythonInfo, [dep], usePipDirectly ? undefined : setProgress, onStdio)
        );
    };

    const uninstallPackage = (dep: Package) => {
        setUninstallingPackage(dep);
        changePackages(() =>
            runPipUninstall(pythonInfo, [dep], usePipDirectly ? undefined : setProgress, onStdio)
        );
    };

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [shellOutput]);

    // whether we are current installing/uninstalling packages or refreshing the list pf installed packages
    const currentlyProcessingDeps =
        pipList === undefined || installingPackage !== null || uninstallingPackage !== null;

    const availableUpdates = useMemo(() => {
        return availableDeps.filter(({ dependencies }) =>
            dependencies.some(({ pypiName, version }) => {
                if (!pipList) {
                    return false;
                }
                const installedVersion = pipList[pypiName];
                if (!installedVersion) {
                    return true;
                }
                return versionGt(version, installedVersion);
            })
        ).length;
    }, [pipList, availableDeps]);

    const value = useMemoObject<DependencyContextValue>({
        openDependencyManager: onOpen,
        availableUpdates,
    });

    const [loadingExtInts, setLoadingExtInts] = useState(true);
    const [externalIntegrationConnections, setExternalIntegrationConnections] = useState<
        ExternalIntegrationConnectionStatus[]
    >([]);

    useAsyncEffect(
        () => ({
            supplier: async () => {
                const connections = await Promise.all(
                    externalIntegrations.map(async (integration) => {
                        try {
                            const connected = await fetch(
                                `http://${integration.url}:${integration.port}`
                            );
                            return { integration, connected: connected.ok };
                        } catch (e) {
                            return { integration, connected: false };
                        }
                    })
                );
                return connections;
            },
            successEffect: setExternalIntegrationConnections,
            finallyEffect: () => setLoadingExtInts(false),
        }),
        []
    );

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
                            <Flex w="full">
                                <Text
                                    flex="1"
                                    textAlign="left"
                                >
                                    {hasNvidia ? 'CUDA supported' : 'CUDA not supported'}
                                </Text>
                            </Flex>
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
                            {!pipList ? (
                                <Spinner />
                            ) : (
                                <Accordion
                                    allowToggle
                                    // allowMultiple={false}
                                    w="full"
                                >
                                    {availableDeps.map((dep) => {
                                        const install = () => installPackage(dep);
                                        const uninstall = () => {
                                            showAlert({
                                                type: AlertType.WARN,
                                                title: 'Uninstall',
                                                message: `Are you sure you want to uninstall ${dep.name}?`,
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
                                                                `You might lose your unsaved changes by uninstalling ${dep.name}.` +
                                                                `\n\nAre you sure you want to uninstall ${dep.name}?`,
                                                            buttons: ['Cancel', 'Uninstall'],
                                                            defaultId: 0,
                                                        });
                                                        if (saveButton === 0) return;
                                                    }

                                                    uninstallPackage(dep);
                                                })
                                                .catch(log.error);
                                        };

                                        return (
                                            <Feature
                                                dep={dep}
                                                isRunningShell={isRunningShell}
                                                key={dep.name}
                                                pipList={pipList}
                                                progress={
                                                    !usePipDirectly &&
                                                    isRunningShell &&
                                                    (installingPackage || uninstallingPackage)
                                                        ?.name === dep.name
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
                            {loadingExtInts ? (
                                <Spinner />
                            ) : (
                                <VStack
                                    textAlign="left"
                                    w="full"
                                >
                                    <Text
                                        fontWeight="bold"
                                        w="full"
                                    >
                                        External Connections
                                    </Text>
                                    {externalIntegrationConnections.map(
                                        ({ integration, connected }) => (
                                            <HStack
                                                key={integration.name}
                                                w="full"
                                            >
                                                <Text>{integration.name}</Text>
                                                <Text color={connected ? 'green.500' : 'gray.500'}>
                                                    {connected ? 'Connected' : 'Not Connected'}
                                                </Text>
                                            </HStack>
                                        )
                                    )}
                                </VStack>
                            )}
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
