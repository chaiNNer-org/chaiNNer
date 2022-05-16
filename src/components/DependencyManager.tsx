import { DeleteIcon, DownloadIcon } from '@chakra-ui/icons';
import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    AlertDialog,
    AlertDialogBody,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
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
    useColorModeValue,
    useDisclosure,
    VStack,
} from '@chakra-ui/react';
import { exec as _exec, spawn } from 'child_process';
import log from 'electron-log';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import semver from 'semver';
import { useContext } from 'use-context-selector';
import util from 'util';
import { PythonKeys } from '../common-types';
import { ExecutionContext } from '../helpers/contexts/ExecutionContext';
import { SettingsContext } from '../helpers/contexts/SettingsContext';
import getAvailableDeps, { Dependency } from '../helpers/dependencies';
import { useAsyncEffect } from '../helpers/hooks/useAsyncEffect';
import pipInstallWithProgress from '../helpers/pipInstallWithProgress';
import { ipcRenderer } from '../helpers/safeIpc';

const exec = util.promisify(_exec);

const checkSemver = (v1: string, v2: string) => {
    try {
        return !semver.gt(semver.coerce(v1)!.version, semver.coerce(v2)!.version);
    } catch (error) {
        log.error(error);
        return true;
    }
};

type ParsedPipList = Record<string, string>;

const parsePipOutput = (output: string): ParsedPipList => {
    const tempPipList = output.split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
    const pipObj: ParsedPipList = {};
    tempPipList.forEach(([dep, version]) => {
        pipObj[dep] = version;
    });
    return pipObj;
};

interface DependencyManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onPipListUpdate?: (value: ParsedPipList) => void;
}

const DependencyManager = ({
    isOpen,
    onClose,
    onPipListUpdate = () => {},
}: DependencyManagerProps) => {
    const { setIsBackendKilled } = useContext(ExecutionContext);
    const { useIsSystemPython } = useContext(SettingsContext);

    const [isSystemPython] = useIsSystemPython;

    const {
        isOpen: isUninstallOpen,
        onOpen: onUninstallOpen,
        onClose: onUninstallClose,
    } = useDisclosure();
    const cancelRef = useRef<HTMLButtonElement>(null);

    const [pythonKeys, setPythonKeys] = useState<PythonKeys>();

    const [isLoadingPipList, setIsLoadingPipList] = useState(true);
    const [pipList, setPipList] = useState<ParsedPipList>({});

    const [installingPackage, setInstallingPackage] = useState<Dependency | null>(null);
    const [uninstallingPackage, setUninstallingPackage] = useState<Dependency | null>(null);

    const consoleRef = useRef<HTMLTextAreaElement | null>(null);
    const [shellOutput, setShellOutput] = useState('');
    const [isRunningShell, setIsRunningShell] = useState(false);
    const [progress, setProgress] = useState(0);

    const [depChanged, setDepChanged] = useState(false);

    const [gpuInfo, setGpuInfo] = useState<string[]>([]);
    const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);
    const [nvidiaGpuName, setNvidiaGpuName] = useState<string | null>(null);

    const [availableDeps, setAvailableDeps] = useState<Dependency[]>([]);

    useEffect(() => {
        const depsArr = getAvailableDeps(isNvidiaAvailable);
        setAvailableDeps(depsArr);
    }, [isNvidiaAvailable]);

    useAsyncEffect(async (token) => {
        const hasNvidia = await ipcRenderer.invoke('get-has-nvidia');
        if (hasNvidia) {
            const gpuName = await ipcRenderer.invoke('get-gpu-name');
            const hasNv = await ipcRenderer.invoke('get-has-nvidia');
            token.causeEffect(() => {
                setNvidiaGpuName(gpuName);
                setIsNvidiaAvailable(hasNv);
            });
        } else {
            const fullGpuInfo = await ipcRenderer.invoke('get-gpu-info');
            const gpuNames = fullGpuInfo.controllers.map((gpu) => gpu.model);
            token.causeEffect(() => setGpuInfo(gpuNames));
        }
    }, []);

    useAsyncEffect<ParsedPipList>(
        {
            supplier: async (token) => {
                const pKeys = await ipcRenderer.invoke('get-python');
                token.causeEffect(() => setPythonKeys(pKeys));
                const { stdout } = await exec(
                    `${pKeys.python} -m pip list --disable-pip-version-check`
                );
                return parsePipOutput(stdout);
            },
            successEffect: (pipObj) => {
                setPipList(pipObj);
                onPipListUpdate(pipObj);
            },
            finallyEffect: () => setIsLoadingPipList(false),
        },
        []
    );

    useAsyncEffect(
        {
            supplier: async () => {
                if (!isRunningShell && pythonKeys) {
                    setIsLoadingPipList(true);
                    // exec(`${pythonKeys.python} -m pip install --upgrade pip`);
                    const { stdout } = await exec(
                        `${pythonKeys.python} -m pip list --disable-pip-version-check`
                    );
                    return parsePipOutput(stdout);
                }
                return undefined;
            },
            successEffect: (pipObj) => {
                if (pipObj) {
                    onPipListUpdate(pipObj);
                    setPipList(pipObj);
                }
            },
            finallyEffect: () => setIsLoadingPipList(false),
        },
        [isRunningShell, pythonKeys]
    );

    useAsyncEffect(async () => {
        if (depChanged) {
            setIsBackendKilled(true);
            await ipcRenderer.invoke('kill-backend');
        }
    }, [depChanged]);

    const runPipCommand = (args: string[]) => {
        setShellOutput('');
        setIsRunningShell(true);
        // TODO: hope and pray pythonKeys is non-null
        const command = spawn(pythonKeys!.python, [
            '-m',
            'pip',
            ...args,
            '--disable-pip-version-check',
        ]);

        let outputString = '';

        command.stdout.on('data', (data: unknown) => {
            outputString += String(data);
            setShellOutput(outputString);
        });

        command.stderr.on('data', (data: unknown) => {
            setShellOutput(String(data));
        });

        command.on('error', (error) => {
            setShellOutput(String(error));
            setIsRunningShell(false);
        });

        command.on('close', (code) => {
            log.info(`child process exited with code ${code ?? 'null'}`);
            setIsRunningShell(false);
        });
    };

    const installPackage = async (dep: Dependency, upgrade: boolean) => {
        setIsRunningShell(true);
        setInstallingPackage(dep);
        let output = '';
        await pipInstallWithProgress(
            // TODO: hope and pray pythonKeys is non-null
            pythonKeys!.python,
            dep,
            setProgress,
            (data) => {
                output += data;
                setShellOutput(output);
            },
            upgrade
        );
        setIsRunningShell(false);
        setProgress(0);
    };

    const uninstallPackage = (dep: Dependency) => {
        setInstallingPackage(null);
        runPipCommand(['uninstall', '-y', dep.packageName]);
    };

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [shellOutput]);

    return (
        <>
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
                                        color={isNvidiaAvailable ? 'inherit' : 'red.500'}
                                        flex="1"
                                        textAlign="left"
                                    >
                                        GPU (
                                        {(isNvidiaAvailable ? nvidiaGpuName : gpuInfo[0]) ??
                                            'No GPU Available'}
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
                                {isLoadingPipList ? (
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
                                                            onClick={() => {
                                                                setDepChanged(true);
                                                                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                                                                installPackage(dep, true);
                                                            }}
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
                                                                setUninstallingPackage(dep);
                                                                onUninstallOpen();
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
                                                        onClick={() => {
                                                            setDepChanged(true);
                                                            // eslint-disable-next-line @typescript-eslint/no-floating-promises
                                                            installPackage(dep, false);
                                                        }}
                                                    >
                                                        Install
                                                    </Button>
                                                )}
                                            </Flex>
                                            {isRunningShell &&
                                                installingPackage?.name === dep.name && (
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

            <AlertDialog
                isOpen={isUninstallOpen}
                leastDestructiveRef={cancelRef}
                onClose={onUninstallClose}
            >
                <AlertDialogOverlay>
                    <AlertDialogContent>
                        <AlertDialogHeader
                            fontSize="lg"
                            fontWeight="bold"
                        >
                            Uninstall
                        </AlertDialogHeader>

                        <AlertDialogBody>
                            Are you sure you want to uninstall {uninstallingPackage?.name}?
                        </AlertDialogBody>

                        <AlertDialogFooter>
                            <Button
                                ref={cancelRef}
                                onClick={onUninstallClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                colorScheme="red"
                                ml={3}
                                onClick={() => {
                                    setDepChanged(true);
                                    onUninstallClose();
                                    // TODO: hope and pray that uninstallingPackage is actually non-null
                                    uninstallPackage(uninstallingPackage!);
                                }}
                            >
                                Uninstall
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialogOverlay>
            </AlertDialog>
        </>
    );
};

export const DependencyManagerButton = memo(() => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [pipList, setPipList] = useState<ParsedPipList>({});

    const [availableDeps, setAvailableDeps] = useState<Dependency[]>([]);
    const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);

    useAsyncEffect(
        {
            supplier: async () => {
                const hasNvidia = await ipcRenderer.invoke('get-has-nvidia');
                if (hasNvidia) {
                    return ipcRenderer.invoke('get-has-nvidia');
                }
                return false;
            },
            successEffect: setIsNvidiaAvailable,
        },
        []
    );

    useEffect(() => {
        const depsArr = getAvailableDeps(isNvidiaAvailable);
        setAvailableDeps(depsArr);
    }, [isNvidiaAvailable]);

    const availableUpdates = useMemo(
        () =>
            availableDeps.filter(({ packageName, version }) => {
                if (Object.keys(pipList).length === 0) {
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
                    ) : (
                        <></>
                    )}
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

export default memo(DependencyManager);
