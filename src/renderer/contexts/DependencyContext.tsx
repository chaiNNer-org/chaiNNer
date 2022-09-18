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
    Progress,
    Spinner,
    Text,
    Textarea,
    Tooltip,
    VStack,
    useDisclosure,
} from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BsTerminalFill } from 'react-icons/bs';
import semver from 'semver';
import { createContext, useContext } from 'use-context-selector';
import { Dependency, PyPiPackage, getOptionalDependencies } from '../../common/dependencies';
import { OnStdio, PipList, runPipInstall, runPipList, runPipUninstall } from '../../common/pip';
import { ipcRenderer } from '../../common/safeIpc';
import { noop } from '../../common/util';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import { useMemoObject } from '../hooks/useMemo';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { ExecutionContext } from './ExecutionContext';
import { SettingsContext } from './SettingsContext';

export interface DependencyContextValue {
    openDependencyManager: () => void;
    availableUpdates: number;
}

export const DependencyContext = createContext<Readonly<DependencyContextValue>>({
    openDependencyManager: noop,
    availableUpdates: 0,
});

const checkSemverGt = (v1: string, v2: string) => {
    try {
        return semver.gt(semver.coerce(v1)!.version, semver.coerce(v2)!.version);
    } catch (error) {
        log.error(error);
        return false;
    }
};

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

const IndividualDep = memo(
    ({
        pkg,
        installed,
        outdated,
        isRunningShell,
    }: {
        pkg: PyPiPackage;
        installed: boolean;
        outdated: boolean;
        isRunningShell: boolean;
    }) => {
        return (
            <Flex
                align="center"
                key={pkg.packageName}
                w="full"
            >
                <Text
                    color={installed ? 'inherit' : 'red.500'}
                    flex="1"
                    textAlign="left"
                >
                    {`${pkg.packageName} (${pkg.version || 'not installed'})`}
                </Text>
            </Flex>
        );
    }
);

const Package = memo(
    ({
        dep,
        pipList,
        isRunningShell,
        progress,
        onInstall,
        onUninstall,
        onUpdate,
    }: {
        dep: Dependency;
        pipList: PipList;
        isRunningShell: boolean;
        progress?: number;
        onInstall: () => void;
        onUninstall: () => void;
        onUpdate: () => void;
    }) => {
        const allDepPackagesInstalled = dep.packages.every((p) => pipList[p.packageName]);
        const outdatedPackages = dep.packages.filter((p) => {
            const installedVersion = pipList[p.packageName];
            return installedVersion && checkSemverGt(p.version, installedVersion);
        });

        return (
            <AccordionItem cursor="pointer">
                <h2>
                    <HStack>
                        <AccordionButton cursor="pointer">
                            <HStack
                                cursor="pointer"
                                w="full"
                            >
                                <Text
                                    cursor="pointer"
                                    flex="1"
                                    textAlign="left"
                                    w="full"
                                >
                                    {dep.name} ({dep.packages.length} package
                                    {dep.packages.length === 1 ? '' : 's'})
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
                        </AccordionButton>
                        {allDepPackagesInstalled ? (
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
                                        Update to {outdatedPackages.map((p) => p.version).join('/')}{' '}
                                        ({formatSizeEstimate(outdatedPackages)})
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
                            <Button
                                colorScheme="blue"
                                disabled={isRunningShell}
                                isLoading={isRunningShell}
                                leftIcon={<DownloadIcon />}
                                size="sm"
                                onClick={onInstall}
                            >
                                Install ({formatSizeEstimate(dep.packages)})
                            </Button>
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
                </h2>
                <AccordionPanel pb={4}>
                    <VStack
                        key={dep.name}
                        w="full"
                    >
                        {dep.packages.map((p) => (
                            <IndividualDep
                                installed={!!pipList[p.packageName]}
                                isRunningShell={isRunningShell}
                                key={p.packageName}
                                outdated={
                                    !!pipList[p.packageName] &&
                                    checkSemverGt(p.version, pipList[p.packageName]!)
                                }
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
    const { setIsBackendKilled } = useContext(ExecutionContext);
    const { useIsSystemPython } = useContext(SettingsContext);
    const { pythonInfo } = useContext(BackendContext);

    const [isSystemPython] = useIsSystemPython;

    const [pipList, setPipList] = useState<PipList>();
    const refreshInstalledPackages = useCallback(() => setPipList(undefined), [setPipList]);

    const [isConsoleOpen, setIsConsoleOpen] = useState(false);

    useAsyncEffect(
        {
            supplier: async () => {
                if (pipList) return undefined;
                return runPipList(pythonInfo);
            },
            successEffect: (list) => {
                if (list) {
                    setPipList(list);
                }
            },
        },
        [pythonInfo, pipList, setPipList]
    );

    const [hasNvidia, setHasNvidia] = useState(false);
    useAsyncEffect(
        {
            supplier: async (): Promise<boolean> => {
                const nvidiaGpu = await ipcRenderer.invoke('get-nvidia-gpu-name');
                if (nvidiaGpu) {
                    return true;
                }
                return false;
            },
            successEffect: setHasNvidia,
        },
        []
    );

    const [availableDeps, setAvailableDeps] = useState<Dependency[]>([]);
    useAsyncEffect(
        {
            supplier: async () => {
                const nvidiaGpu = await ipcRenderer.invoke('get-nvidia-gpu-name');
                const isNvidiaAvailable = nvidiaGpu !== null;
                return getOptionalDependencies(isNvidiaAvailable);
            },
            successEffect: setAvailableDeps,
        },
        []
    );

    const [installingPackage, setInstallingPackage] = useState<Dependency | null>(null);
    const [uninstallingPackage, setUninstallingPackage] = useState<Dependency | null>(null);

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

    const [depChanged, setDepChanged] = useState(false);
    useAsyncEffect(async () => {
        if (depChanged) {
            setIsBackendKilled(true);
            await ipcRenderer.invoke('kill-backend');
        }
    }, [depChanged]);

    const changePackages = (supplier: () => Promise<void>) => {
        if (isRunningShell) throw new Error('Cannot run two pip commands at once');

        setShellOutput('');
        setIsRunningShell(true);
        setProgress(0);
        setDepChanged(true);

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
            });
    };

    const installPackage = (dep: Dependency) => {
        setInstallingPackage(dep);
        changePackages(() => runPipInstall(pythonInfo, [dep], setProgress, onStdio));
    };

    const uninstallPackage = (dep: Dependency) => {
        setUninstallingPackage(dep);
        changePackages(() => runPipUninstall(pythonInfo, [dep], setProgress, onStdio));
    };

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [shellOutput]);

    const availableUpdates = useMemo(() => {
        return availableDeps.filter(({ packages }) =>
            packages.some(({ packageName, version }) => {
                if (!pipList) {
                    return false;
                }
                const installedVersion = pipList[packageName];
                if (!installedVersion) {
                    return true;
                }
                return checkSemverGt(version, installedVersion);
            })
        ).length;
    }, [pipList, availableDeps]);

    const value = useMemoObject<DependencyContextValue>({
        openDependencyManager: onOpen,
        availableUpdates,
    });

    return (
        <DependencyContext.Provider value={value}>
            {children}
            <Modal
                isCentered
                closeOnOverlayClick={!depChanged}
                isOpen={isOpen}
                returnFocusOnClose={false}
                scrollBehavior="inside"
                size="xl"
                onClose={onClose}
            >
                <ModalOverlay cursor={depChanged ? 'disabled' : 'default'} />
                <ModalContent maxW="750px">
                    <ModalHeader>Dependency Manager</ModalHeader>
                    <ModalCloseButton disabled={depChanged} />
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
                                <IconButton
                                    aria-label="Open Console View"
                                    icon={<BsTerminalFill />}
                                    size="sm"
                                    onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                                />
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
                                                defaultButton: 0,
                                            })
                                                .then((button) => {
                                                    if (button === 1) {
                                                        uninstallPackage(dep);
                                                    }
                                                })
                                                .catch((error) => log.error(error));
                                        };

                                        return (
                                            <Package
                                                dep={dep}
                                                isRunningShell={isRunningShell}
                                                key={dep.name}
                                                pipList={pipList}
                                                progress={
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
                        </VStack>
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            colorScheme="blue"
                            disabled={depChanged}
                            mr={3}
                            variant={depChanged ? 'ghost' : 'solid'}
                            onClick={onClose}
                        >
                            Close
                        </Button>
                        <Button
                            colorScheme="blue"
                            variant={depChanged ? 'solid' : 'ghost'}
                            // eslint-disable-next-line @typescript-eslint/no-misused-promises
                            onClick={async () => ipcRenderer.invoke('relaunch-application')}
                        >
                            Restart chaiNNer
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </DependencyContext.Provider>
    );
});
