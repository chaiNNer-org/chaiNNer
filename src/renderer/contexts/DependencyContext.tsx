import { CopyIcon, DeleteIcon, DownloadIcon, InfoIcon } from '@chakra-ui/icons';
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
    IconButton,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BsQuestionCircle } from 'react-icons/bs';
import { HiOutlineRefresh } from 'react-icons/hi';
import { MdSettings } from 'react-icons/md';
import { useQuery } from 'react-query';
import { createContext, useContext } from 'use-context-selector';
import {
    Feature,
    FeatureId,
    FeatureState,
    Package,
    PackageId,
    PyPiName,
    PyPiPackage,
    PythonInfo,
    Version,
} from '../../common/common-types';
import { log } from '../../common/log';
import { EMPTY_ARRAY, isNotNullish, joinEnglish, noop } from '../../common/util';
import { versionGt } from '../../common/version';
import { Markdown } from '../components/Markdown';
import {
    useBackendEventSourceListener,
    useBackendSetupEventSource,
} from '../hooks/useBackendEventSource';
import { useMemoObject } from '../hooks/useMemo';
import { useSettings } from '../hooks/useSettings';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { GlobalContext } from './GlobalNodeState';

export interface DependencyContextValue {
    openDependencyManager: () => void;
    availableUpdates: number;
}

export const DependencyContext = createContext<Readonly<DependencyContextValue>>({
    openDependencyManager: noop,
    availableUpdates: 0,
});

enum InstallMode {
    NORMAL = 'normal',
    COPY = 'copy',
}

const getFindLinks = (dependencies: readonly PyPiPackage[]): string[] => {
    return [...new Set<string>(dependencies.map((p) => p.findLink).filter(isNotNullish))];
};
const getInstallCommand = (packages: readonly Package[], pythonInfo: PythonInfo): string => {
    const deps = packages.flatMap((pkg) =>
        pkg.dependencies.map((p) => `${p.pypiName}==${p.version}`)
    );
    const findLinks = packages.flatMap((pkg) =>
        getFindLinks(pkg.dependencies).flatMap((l) => ['--extra-index-url', l])
    );
    const args = [
        pythonInfo.python,
        '-m',
        'chainner_pip',
        'install',
        '--upgrade',
        ...deps,
        ...findLinks,
    ];
    return args.join(' ');
};
const getUninstallCommand = (packages: readonly Package[], pythonInfo: PythonInfo): string => {
    const deps = packages.flatMap((pkg) => pkg.dependencies.map((p) => p.pypiName));
    const args = [pythonInfo.python, '-m', 'chainner_pip', 'uninstall', ...deps];
    return args.join(' ');
};

const formatBytes = (bytes: number): string => {
    const KB = 1024 ** 1;
    const MB = 1024 ** 2;
    const GB = 1024 ** 3;

    const rounded = (n: number): string => {
        if (n < 10) return Number(n.toPrecision(2)).toString();
        return n.toFixed(0);
    };

    if (bytes < KB) return `${bytes}\u2009Byte`;
    if (bytes < MB) return `${rounded(bytes / KB)}\u2009KB`;
    if (bytes < GB) return `${rounded(bytes / MB)}\u2009MB`;
    return `${rounded(bytes / GB)}\u2009GB`;
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
                    {pkg.displayName}
                </Text>
                {!!tagText && <Tag color={color}>{tagText}</Tag>}
                <Tag>{versionString}</Tag>
                <Spacer />
            </HStack>
        );
    }
);

class PackageUpdateInfo {
    readonly missing: readonly PyPiPackage[];

    readonly outdated: readonly PyPiPackage[];

    get canInstall(): boolean {
        return this.missing.length > 0;
    }

    get canUpdate(): boolean {
        return this.outdated.length > 0;
    }

    constructor(pkg: Package, installedPyPi: Readonly<Partial<Record<PyPiName, Version>>>) {
        const missing: PyPiPackage[] = [];
        const outdated: PyPiPackage[] = [];

        for (const dep of pkg.dependencies) {
            const installed = installedPyPi[dep.pypiName];
            if (!installed) {
                missing.push(dep);
            } else if (versionGt(dep.version, installed)) {
                outdated.push(dep);
            }
        }

        this.missing = missing;
        this.outdated = outdated;
    }
}

const PackageView = memo(
    ({
        p,
        isRunningShell,
        progress,
        installedPyPi,
        packageInfo,
        isInstalling,
        onInstall,
        onUninstall,
        onUpdate,
    }: {
        p: Package;
        isRunningShell: boolean;
        progress?: number;
        installedPyPi: Readonly<Partial<Record<PyPiName, Version>>>;
        packageInfo: PackageUpdateInfo;
        isInstalling: boolean;
        onInstall: () => void;
        onUninstall: () => void;
        onUpdate: () => void;
    }) => {
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
                                        openDelay={200}
                                        px={2}
                                        py={1}
                                    >
                                        <InfoIcon />
                                    </Tooltip>
                                </HStack>
                            </AccordionButton>
                            {!packageInfo.canInstall ? (
                                <HStack py={2}>
                                    {packageInfo.canUpdate && (
                                        <Button
                                            colorScheme="blue"
                                            disabled={isRunningShell}
                                            isLoading={isRunningShell && isInstalling}
                                            leftIcon={<DownloadIcon />}
                                            size="sm"
                                            onClick={onUpdate}
                                        >
                                            Update ({formatSizeEstimate(packageInfo.outdated)})
                                        </Button>
                                    )}

                                    <Button
                                        colorScheme="red"
                                        isDisabled={isRunningShell}
                                        isLoading={isRunningShell && isInstalling}
                                        leftIcon={<DeleteIcon />}
                                        size="sm"
                                        onClick={onUninstall}
                                    >
                                        Uninstall
                                    </Button>
                                </HStack>
                            ) : (
                                <HStack py={2}>
                                    <Button
                                        colorScheme="blue"
                                        isDisabled={isRunningShell}
                                        isLoading={isRunningShell && isInstalling}
                                        leftIcon={<DownloadIcon />}
                                        size="sm"
                                        onClick={onInstall}
                                    >
                                        Install (
                                        {formatSizeEstimate([
                                            ...packageInfo.missing,
                                            ...packageInfo.outdated,
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

interface PackagesSectionProps {
    installPackages: (...packages: Package[]) => void;
    uninstallPackages: (...packages: Package[]) => Promise<void>;
    packages: readonly Package[];
    modifyingPackages: readonly PackageId[];
    installedPyPi: Readonly<Partial<Record<PyPiName, Version>>> | undefined;
    isRunningShell: boolean;
    progress?: number;
}
const PackagesSection = memo(
    ({
        installPackages,
        uninstallPackages,
        packages,
        modifyingPackages,
        installedPyPi,
        isRunningShell,
        progress,
    }: PackagesSectionProps) => {
        const infos = packages.map((p) => new PackageUpdateInfo(p, installedPyPi || {}));

        const canUpdate = infos.filter((i) => i.canUpdate).length;
        const canInstall = infos.filter((i) => i.canInstall).length;

        const operationsForAll = [
            ...(canUpdate ? ['Update'] : []),
            ...(canInstall ? ['Install'] : []),
        ].join('/');
        const showAll = canUpdate + canInstall > 1;
        const allOperationPackages = packages.filter((_, i) => {
            const info = infos[i];
            return info.canInstall || info.canUpdate;
        });

        return (
            <Box w="full">
                <Flex
                    mb={2}
                    mt={2}
                >
                    <HStack flex="1">
                        <Text
                            fontWeight="bold"
                            lineHeight={8}
                        >
                            Packages
                        </Text>
                    </HStack>
                    {showAll && (
                        <Button
                            colorScheme="blue"
                            isDisabled={isRunningShell}
                            isLoading={isRunningShell && modifyingPackages.length > 1}
                            leftIcon={<DownloadIcon />}
                            mr={10}
                            size="sm"
                            onClick={() => {
                                installPackages(...allOperationPackages);
                            }}
                        >
                            {`${operationsForAll} All Packages (${formatSizeEstimate(
                                allOperationPackages.flatMap((p) => p.dependencies)
                            )})`}
                        </Button>
                    )}
                </Flex>
                {!installedPyPi ? (
                    <Spinner />
                ) : (
                    <Accordion
                        allowToggle
                        w="full"
                    >
                        {packages.map((p, index) => {
                            if (p.dependencies.length === 0) {
                                return null;
                            }

                            const install = () => installPackages(p);
                            const uninstall = () => {
                                uninstallPackages(p).catch(log.error);
                            };

                            const info = infos[index];
                            const isInstalling = modifyingPackages.includes(p.id);

                            return (
                                <PackageView
                                    installedPyPi={installedPyPi}
                                    isInstalling={isInstalling}
                                    isRunningShell={isRunningShell}
                                    key={p.id}
                                    p={p}
                                    packageInfo={info}
                                    progress={isInstalling ? progress : undefined}
                                    onInstall={install}
                                    onUninstall={uninstall}
                                    onUpdate={install}
                                />
                            );
                        })}
                    </Accordion>
                )}
            </Box>
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

interface FeaturesSectionProps {
    processingDeps: boolean;
}
const FeaturesSection = memo(({ processingDeps }: FeaturesSectionProps) => {
    const { packages, featureStates, refreshFeatureStates } = useContext(BackendContext);

    const features = useMemo(() => packages.flatMap((p) => p.features), [packages]);
    const [isRefreshingFeatureStates, setIsRefreshingFeatureStates] = useState(false);

    return (
        <Box w="full">
            <Flex
                mb={2}
                mt={2}
            >
                <HStack flex="1">
                    <Text
                        fontWeight="bold"
                        lineHeight={8}
                    >
                        Features
                    </Text>
                </HStack>
                <Button
                    isDisabled={processingDeps}
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
    );
});

interface PythonSectionProps {
    installMode: InstallMode;
    setInstallMode: (mode: InstallMode) => void;
    consoleOutput: string;
    isDisabled: boolean;
}
const PythonSection = memo(
    ({ installMode, setInstallMode, isDisabled, consoleOutput }: PythonSectionProps) => {
        const { useSystemPython } = useSettings();
        const { pythonInfo } = useContext(BackendContext);

        const [showMore, setShowMore] = useState(false);

        const isConsoleOpen = installMode === InstallMode.NORMAL;
        const consoleRef = useRef<HTMLTextAreaElement | null>(null);
        useEffect(() => {
            if (consoleRef.current) {
                consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
            }
        }, [consoleOutput]);

        return (
            <Box w="full">
                <Flex
                    align="center"
                    gap={2}
                    w="full"
                >
                    <Text
                        flex="1"
                        textAlign="left"
                    >
                        Python ({pythonInfo.version}) [{useSystemPython ? 'System' : 'Integrated'}]
                    </Text>

                    <Tooltip
                        hasArrow
                        borderRadius={8}
                        label={
                            <Markdown nonInteractive>
                                {`Copy Python path to clipboard\n\nPython path is: \\\n\`${pythonInfo.python}\``}
                            </Markdown>
                        }
                        maxWidth="none"
                        openDelay={500}
                        placement="top"
                    >
                        <IconButton
                            aria-label="Copy Python path to clipboard"
                            icon={<CopyIcon />}
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                navigator.clipboard.writeText(pythonInfo.python).catch(log.error);
                            }}
                        />
                    </Tooltip>

                    <Button
                        leftIcon={<MdSettings />}
                        size="sm"
                        onClick={() => setShowMore((prev) => !prev)}
                    >
                        Advanced
                    </Button>
                </Flex>

                <Center
                    animateOpacity
                    as={Collapse}
                    in={showMore}
                    w="full"
                >
                    <Box my={2}>
                        <Divider w="full" />

                        <Flex
                            gap={2}
                            ml={4}
                            my={2}
                        >
                            <Center>
                                <Text whiteSpace="nowrap">Installation mode</Text>
                            </Center>
                            <Tooltip
                                hasArrow
                                borderRadius={8}
                                label={
                                    <Markdown nonInteractive>
                                        {'ChaiNNer supports 2 ways of installing packages:\n\n' +
                                            '- Normal: This is the default installation mode. This mode will automatically handle the dependency install for you and will report progress along the way.\n' +
                                            '- Manual/Copy: Copy the pip install command to your clipboard for you to run in your own terminal. You will have to manually restart chaiNNer afterwards.'}
                                    </Markdown>
                                }
                                openDelay={500}
                            >
                                <Center>
                                    <Icon as={BsQuestionCircle} />
                                </Center>
                            </Tooltip>
                            <Spacer />
                            <Box>
                                <Select
                                    isDisabled={isDisabled}
                                    size="sm"
                                    value={installMode}
                                    onChange={(e) => {
                                        const mode = e.target.value as InstallMode;
                                        setInstallMode(mode);
                                    }}
                                >
                                    <option value={InstallMode.NORMAL}>Normal</option>
                                    <option value={InstallMode.COPY}>Manual/Copy</option>
                                </Select>
                            </Box>
                        </Flex>

                        <Center
                            animateOpacity
                            as={Collapse}
                            in={isConsoleOpen}
                            w="full"
                        >
                            <Center w="full">
                                <Textarea
                                    readOnly
                                    cursor="text"
                                    fontFamily="monospace"
                                    fontSize="sm"
                                    h="8rem"
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
                                    value={consoleOutput.trimEnd()}
                                    w="full"
                                    onChange={(e) => e.preventDefault()}
                                    onClick={(e) => e.preventDefault()}
                                    onFocus={(e) => e.preventDefault()}
                                />
                            </Center>
                        </Center>

                        {!isConsoleOpen && <Divider w="full" />}
                    </Box>
                </Center>
            </Box>
        );
    }
);

export const DependencyProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const { isOpen, onOpen, onClose } = useDisclosure();

    const { showAlert, sendToast } = useContext(AlertBoxContext);
    const { backend, url, pythonInfo, backendDownRef, packages, refreshNodes } =
        useContext(BackendContext);
    const { hasRelevantUnsavedChangesRef } = useContext(GlobalContext);

    const [installMode, setInstallMode] = useState(InstallMode.NORMAL);

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

    const [modifyingPackages, setModifyingPackages] = useState<readonly PackageId[]>(EMPTY_ARRAY);

    const [consoleOutput, setConsoleOutput] = useState('Console output:\n\n');
    const [isRunningShell, setIsRunningShell] = useState(false);
    const logOutput = useCallback(
        (message: string) => {
            setConsoleOutput((prev) => {
                const cleaned = message.replace(/\r\n/g, '\n').trimEnd();
                return `${prev + cleaned}\n`.slice(-10000);
            });
        },
        [setConsoleOutput]
    );

    const [individualProgress, setIndividualProgress] = useState(0);
    const [overallProgress, setOverallProgress] = useState(0);
    const [eventSource] = useBackendSetupEventSource(url);
    useBackendEventSourceListener(eventSource, 'package-install-status', (f) => {
        if (f) {
            setOverallProgress(f.progress);
            setIndividualProgress(f.statusProgress ?? 0);

            if (f.message) {
                const progress = f.statusProgress
                    ? ` (${Math.floor(f.statusProgress * 100)}%)`
                    : '';
                logOutput(f.message.trimEnd() + progress);
            }
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const changePackages = (packages: Package[], supplier: () => Promise<void>) => {
        if (isRunningShell) throw new Error('Cannot run two pip commands at once');

        setModifyingPackages(packages.map((pkg) => pkg.id));
        setIsRunningShell(true);
        setOverallProgress(0);
        setIndividualProgress(0);
        backendDownRef.current = true;

        supplier()
            .catch((error) => {
                logOutput(String(error));
                log.error(error);
            })
            .finally(() => {
                refetchInstalledPyPi()
                    .catch(log.error)
                    .then(() => {
                        setIsRunningShell(false);
                        setModifyingPackages(EMPTY_ARRAY);
                        setOverallProgress(0);
                        setIndividualProgress(0);
                        backendDownRef.current = false;
                        refreshNodes();
                    })
                    .catch(log.error);
            });
    };

    const copyCommandToClipboard = (command: string) => {
        navigator.clipboard
            .writeText(command)
            .then(() => {
                sendToast({
                    status: 'success',
                    title: 'Command copied to clipboard',
                    description:
                        'Open up an external terminal, paste the command, and run it. When it is done running, manually restart chaiNNer.',
                    duration: 5_000,
                    id: 'copy-to-clipboard-toast',
                });
            })
            .catch(log.error);
    };

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const installPackages = (...packages: Package[]) => {
        if (installMode === InstallMode.COPY) {
            // TODO: Make this feature get the command from the backend directly
            copyCommandToClipboard(getInstallCommand(packages, pythonInfo));
            return;
        }

        const name = joinEnglish(packages.map((pkg) => pkg.name));

        logOutput(`Installing ${name}...`);
        changePackages(packages, () => backend.installPackages(packages.map((pkg) => pkg.id)));
    };

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const uninstallPackages = async (...packages: Package[]) => {
        if (installMode === InstallMode.COPY) {
            copyCommandToClipboard(getUninstallCommand(packages, pythonInfo));
            return;
        }

        const name = joinEnglish(packages.map((pkg) => pkg.name));

        const button = await showAlert({
            type: AlertType.WARN,
            title: 'Uninstall',
            message: `Are you sure you want to uninstall ${name}?`,
            buttons: ['Cancel', 'Uninstall'],
            defaultId: 0,
        });
        if (button === 0) return;

        if (hasRelevantUnsavedChangesRef.current) {
            const saveButton = await showAlert({
                type: AlertType.WARN,
                title: 'Unsaved Changes',
                message:
                    `You might lose your unsaved changes by uninstalling ${name}.` +
                    `\n\nAre you sure you want to uninstall ${name}?`,
                buttons: ['Cancel', 'Uninstall'],
                defaultId: 0,
            });
            if (saveButton === 0) return;
        }

        logOutput(`Uninstalling ${name}...`);
        changePackages(packages, () => backend.uninstallPackages(packages.map((pkg) => pkg.id)));
    };

    // whether we are current installing/uninstalling packages or refreshing the list of installed packages
    const currentlyProcessingDeps = installedPyPi === undefined || modifyingPackages.length > 0;

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

    let progress;
    if (installMode === InstallMode.NORMAL && isRunningShell) {
        const totalDeps = packages
            .filter((pkg) => modifyingPackages.includes(pkg.id))
            .map((pkg) => pkg.dependencies.length)
            .reduce((a, b) => a + b, 0);
        progress = (overallProgress + individualProgress / (totalDeps + 1)) * 100;
    }

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
                    <ModalCloseButton isDisabled={currentlyProcessingDeps} />
                    <ModalBody>
                        <VStack
                            spacing={4}
                            w="full"
                        >
                            <PythonSection
                                consoleOutput={consoleOutput}
                                installMode={installMode}
                                isDisabled={isRunningShell}
                                setInstallMode={setInstallMode}
                            />
                            <PackagesSection
                                installPackages={installPackages}
                                installedPyPi={installedPyPi}
                                isRunningShell={isRunningShell}
                                modifyingPackages={modifyingPackages}
                                packages={packages}
                                progress={progress}
                                uninstallPackages={uninstallPackages}
                            />
                            <FeaturesSection processingDeps={currentlyProcessingDeps} />
                        </VStack>
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            colorScheme="blue"
                            isDisabled={currentlyProcessingDeps}
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
