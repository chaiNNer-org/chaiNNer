import { DeleteIcon, DownloadIcon } from '@chakra-ui/icons';
import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Box,
    Button,
    Center,
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
    StackDivider,
    Tag,
    TagLabel,
    Text,
    Textarea,
    Tooltip,
    VStack,
    useColorModeValue,
    useDisclosure,
} from '@chakra-ui/react';
import log from 'electron-log';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import semver from 'semver';
import { useContext } from 'use-context-selector';
import { PythonKeys } from '../../common/common-types';
import { Dependency, getOptionalDependencies } from '../../common/dependencies';
import { OnStdio, PipList, runPipInstall, runPipList, runPipUninstall } from '../../common/pip';
import { getPythonKeys } from '../../common/python';
import { ipcRenderer } from '../../common/safeIpc';
import { noop } from '../../common/util';
import { AlertBoxContext, AlertType } from '../contexts/AlertBoxContext';
import { ExecutionContext } from '../contexts/ExecutionContext';
import { SettingsContext } from '../contexts/SettingsContext';
import { useAsyncEffect } from '../hooks/useAsyncEffect';

const checkSemver = (v1: string, v2: string) => {
    try {
        return !semver.gt(semver.coerce(v1)!.version, semver.coerce(v2)!.version);
    } catch (error) {
        log.error(error);
        return true;
    }
};

interface DependencyManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onPipListUpdate?: (value: PipList) => void;
}

type GpuInfo = { isNvidia: true; nvidiaGpu: string } | { isNvidia: false; gpuNames: string[] };

const DependencyManager = memo(
    ({ isOpen, onClose, onPipListUpdate = noop }: DependencyManagerProps) => {
        const { showAlert } = useContext(AlertBoxContext);
        const { setIsBackendKilled } = useContext(ExecutionContext);
        const { useIsSystemPython } = useContext(SettingsContext);

        const [isSystemPython] = useIsSystemPython;

        const [pythonKeys, setPythonKeys] = useState<PythonKeys>();
        const [pipList, setPipList] = useState<PipList>();
        const refreshInstalledPackages = useCallback(() => setPipList(undefined), [setPipList]);

        useAsyncEffect(
            {
                supplier: getPythonKeys,
                successEffect: setPythonKeys,
            },
            [setPythonKeys]
        );
        useAsyncEffect(
            {
                supplier: async () => {
                    if (pipList) return undefined;
                    return runPipList();
                },
                successEffect: (list) => {
                    if (list) {
                        setPipList(list);
                        onPipListUpdate(list);
                    }
                },
            },
            [pipList, setPipList]
        );

        const [gpu, setGpu] = useState<GpuInfo>({ isNvidia: false, gpuNames: [] });
        useAsyncEffect(
            {
                supplier: async (): Promise<GpuInfo> => {
                    const nvidiaGpu = await ipcRenderer.invoke('get-nvidia-gpu-name');
                    if (nvidiaGpu) {
                        return { isNvidia: true, nvidiaGpu };
                    }

                    const fullGpuInfo = await ipcRenderer.invoke('get-gpu-info');
                    const gpuNames = fullGpuInfo.controllers.map((g) => g.model);
                    return { isNvidia: false, gpuNames };
                },
                successEffect: setGpu,
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
            changePackages(() => runPipInstall([dep], setProgress, onStdio));
        };

        const uninstallPackage = (dep: Dependency) => {
            setUninstallingPackage(dep);
            changePackages(() => runPipUninstall([dep.packageName], onStdio));
        };

        useEffect(() => {
            if (consoleRef.current) {
                consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
            }
        }, [shellOutput]);

        return (
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
                        <VStack
                            divider={<StackDivider />}
                            w="full"
                        >
                            <VStack
                                divider={<StackDivider />}
                                w="full"
                            >
                                <Flex
                                    align="center"
                                    w="full"
                                >
                                    <Text
                                        color={gpu.isNvidia ? 'inherit' : 'red.500'}
                                        flex="1"
                                        textAlign="left"
                                    >
                                        GPU (
                                        {gpu.isNvidia
                                            ? gpu.nvidiaGpu
                                            : gpu.gpuNames[0] ?? 'No GPU available'}
                                        )
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
                                        Python ({pythonKeys?.version}) [
                                        {isSystemPython ? 'System' : 'Integrated'}]
                                    </Text>
                                </Flex>
                                {!pipList ? (
                                    <Spinner />
                                ) : (
                                    availableDeps.map((dep) => (
                                        <VStack
                                            key={dep.name}
                                            w="full"
                                        >
                                            <Flex
                                                align="center"
                                                key={dep.name}
                                                w="full"
                                            >
                                                {/* <Text>{`Installed version: ${dep.version ?? 'None'}`}</Text> */}
                                                <Text
                                                    color={
                                                        pipList[dep.packageName]
                                                            ? 'inherit'
                                                            : 'red.500'
                                                    }
                                                    flex="1"
                                                    textAlign="left"
                                                >
                                                    {`${dep.name} (${
                                                        pipList[dep.packageName]
                                                            ? pipList[dep.packageName]
                                                            : 'not installed'
                                                    })`}
                                                </Text>
                                                {pipList[dep.packageName] ? (
                                                    <HStack>
                                                        <Button
                                                            colorScheme="blue"
                                                            disabled={
                                                                checkSemver(
                                                                    dep.version,
                                                                    pipList[dep.packageName]
                                                                ) || isRunningShell
                                                            }
                                                            isLoading={isRunningShell}
                                                            leftIcon={<DownloadIcon />}
                                                            size="sm"
                                                            onClick={() => installPackage(dep)}
                                                        >
                                                            {`Update${
                                                                !checkSemver(
                                                                    dep.version,
                                                                    pipList[dep.packageName]
                                                                )
                                                                    ? ` (${dep.version})`
                                                                    : ''
                                                            }`}
                                                        </Button>
                                                        <Button
                                                            colorScheme="red"
                                                            disabled={isRunningShell}
                                                            leftIcon={<DeleteIcon />}
                                                            size="sm"
                                                            onClick={() => {
                                                                showAlert({
                                                                    type: AlertType.WARN,
                                                                    title: 'Uninstall',
                                                                    message: `Are you sure you want to uninstall ${dep.name}?`,
                                                                    buttons: [
                                                                        'Cancel',
                                                                        'Uninstall',
                                                                    ],
                                                                    defaultButton: 0,
                                                                })
                                                                    .then((button) => {
                                                                        if (button === 1) {
                                                                            uninstallPackage(dep);
                                                                        }
                                                                    })
                                                                    .catch((error) =>
                                                                        log.error(error)
                                                                    );
                                                            }}
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
                                                        onClick={() => installPackage(dep)}
                                                    >
                                                        Install
                                                    </Button>
                                                )}
                                            </Flex>
                                            {isRunningShell &&
                                                (installingPackage || uninstallingPackage)?.name ===
                                                    dep.name && (
                                                    <Center
                                                        h={8}
                                                        w="full"
                                                    >
                                                        <Progress
                                                            hasStripe
                                                            value={progress}
                                                            w="full"
                                                        />
                                                    </Center>
                                                )}
                                        </VStack>
                                    ))
                                )}
                            </VStack>
                            <Accordion
                                allowToggle
                                w="full"
                            >
                                <AccordionItem>
                                    <h2>
                                        <AccordionButton>
                                            <Box
                                                flex="1"
                                                textAlign="left"
                                            >
                                                Console Output
                                            </Box>
                                            <AccordionIcon />
                                        </AccordionButton>
                                    </h2>
                                    <AccordionPanel pb={4}>
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
                                                    backgroundColor: useColorModeValue(
                                                        'gray.300',
                                                        'gray.600'
                                                    ),
                                                },
                                            }}
                                            value={shellOutput}
                                            w="full"
                                            onChange={(e) => e.preventDefault()}
                                            onClick={(e) => e.preventDefault()}
                                            onFocus={(e) => e.preventDefault()}
                                        />
                                    </AccordionPanel>
                                </AccordionItem>
                            </Accordion>
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
        );
    }
);

export const DependencyManagerButton = memo(() => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [pipList, setPipList] = useState<PipList>();

    const [availableDeps, setAvailableDeps] = useState<Dependency[]>([]);
    const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);

    useAsyncEffect(
        {
            supplier: async () => {
                const nvidiaGpu = await ipcRenderer.invoke('get-nvidia-gpu-name');
                return !!nvidiaGpu;
            },
            successEffect: setIsNvidiaAvailable,
        },
        []
    );

    useEffect(() => {
        const depsArr = getOptionalDependencies(isNvidiaAvailable);
        setAvailableDeps(depsArr);
    }, [isNvidiaAvailable]);

    const availableUpdates = useMemo(
        () =>
            availableDeps.filter(({ packageName, version }) => {
                if (!pipList) {
                    return false;
                }
                if (!pipList[packageName]) {
                    return true;
                }
                return !checkSemver(version, pipList[packageName]);
            }),
        [availableDeps, pipList, isNvidiaAvailable]
    );

    return (
        <>
            <Tooltip
                closeOnClick
                closeOnMouseDown
                borderRadius={8}
                label="Manage Dependencies"
                px={2}
                py={1}
            >
                <VStack
                    m={0}
                    spacing={0}
                >
                    {availableUpdates.length ? (
                        <Tag
                            borderRadius="full"
                            colorScheme="red"
                            ml={-7}
                            mt={-1}
                            position="fixed"
                            size="sm"
                        >
                            <TagLabel textAlign="center">{availableUpdates.length}</TagLabel>
                        </Tag>
                    ) : null}
                    <IconButton
                        aria-label="Download button"
                        icon={<DownloadIcon />}
                        position="relative"
                        size="md"
                        variant="outline"
                        onClick={onOpen}
                    />
                </VStack>
            </Tooltip>
            <DependencyManager
                isOpen={isOpen}
                onClose={onClose}
                onPipListUpdate={setPipList}
            />
        </>
    );
});

export default DependencyManager;
