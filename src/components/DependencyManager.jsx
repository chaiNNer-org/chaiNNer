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
import { exec, spawn } from 'child_process';
import { ipcRenderer } from 'electron';
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import semver from 'semver';
import { SettingsContext } from '../helpers/contexts/SettingsContext.jsx';
import getAvailableDeps from '../helpers/dependencies.js';
import pipInstallWithProgress from '../helpers/pipInstallWithProgress.js';

const checkSemver = (v1, v2) => {
  try {
    return !semver.gt(semver.coerce(v1).version, semver.coerce(v2).version);
  } catch (error) {
    console.log(error);
    return true;
  }
};

const DependencyManager = ({ isOpen, onClose, onPipListUpdate = () => {} }) => {
  const { useIsSystemPython } = useContext(SettingsContext);

  const [isSystemPython] = useIsSystemPython;

  const {
    isOpen: isUninstallOpen,
    onOpen: onUninstallOpen,
    onClose: onUninstallClose,
  } = useDisclosure();
  const cancelRef = useRef();

  const [deps, setDeps] = useState({});
  const [pythonKeys, setPythonKeys] = useState({});

  const [isLoadingPipList, setIsLoadingPipList] = useState(true);
  const [pipList, setPipList] = useState({});

  const [installingPackage, setInstallingPackage] = useState(null);
  const [uninstallingPackage, setUninstallingPackage] = useState('');

  const consoleRef = useRef(null);
  const [shellOutput, setShellOutput] = useState('');
  const [isRunningShell, setIsRunningShell] = useState(false);
  const [progress, setProgress] = useState(0);

  const [depChanged, setDepChanged] = useState(false);

  const [gpuInfo, setGpuInfo] = useState([]);
  const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);
  const [nvidiaGpuName, setNvidiaGpuName] = useState(null);

  const [availableDeps, setAvailableDeps] = useState([]);

  useEffect(() => {
    const depsArr = getAvailableDeps(isNvidiaAvailable);
    setAvailableDeps(depsArr);
  }, [isNvidiaAvailable]);

  useEffect(() => {
    (async () => {
      const hasNvidia = await ipcRenderer.invoke('get-has-nvidia');
      if (hasNvidia) {
        setNvidiaGpuName(await ipcRenderer.invoke('get-gpu-name'));
        setIsNvidiaAvailable(await ipcRenderer.invoke('get-has-nvidia'));
      } else {
        const fullGpuInfo = await ipcRenderer.invoke('get-gpu-info');
        const gpuNames = fullGpuInfo?.controllers.map((gpu) => gpu.model);
        setGpuInfo(gpuNames);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const pKeys = await ipcRenderer.invoke('get-python');
      setPythonKeys(pKeys);
      setDeps({
        ...deps,
        pythonVersion: pKeys.version,
      });
      exec(`${pKeys.python} -m pip list --disable-pip-version-check`, (error, stdout) => {
        if (error) {
          setIsLoadingPipList(false);
          return;
        }
        const tempPipList = String(stdout)
          .split('\n')
          .map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
        const pipObj = {};
        tempPipList.forEach(([dep, version]) => {
          pipObj[dep] = version;
        });
        setPipList(pipObj);
        onPipListUpdate(pipObj);
        setIsLoadingPipList(false);
      });
    })();
  }, []);

  useEffect(() => {
    if (!isRunningShell) {
      setIsLoadingPipList(true);
      // exec(`${pythonKeys.python} -m pip install --upgrade pip`);
      exec(
        `${pythonKeys.python} -m pip list --disable-pip-version-check`,
        (error, stdout, stderr) => {
          if (error || stderr) {
            setIsLoadingPipList(false);
            return;
          }
          const tempPipList = String(stdout)
            .split('\n')
            .map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
          const pipObj = {};
          tempPipList.forEach(([dep, version]) => {
            pipObj[dep] = version;
          });
          setPipList(pipObj);
          onPipListUpdate(pipObj);
          setIsLoadingPipList(false);
        }
      );
    }
  }, [isRunningShell, pythonKeys]);

  useEffect(() => {
    (async () => {
      if (depChanged) {
        await ipcRenderer.invoke('kill-backend');
      }
    })();
  }, [depChanged]);

  const runPipCommand = (args) => {
    setShellOutput('');
    setIsRunningShell(true);
    const command = spawn(pythonKeys.python, ['-m', 'pip', ...args, '--disable-pip-version-check']);

    let outputString = '';

    command.stdout.on('data', (data) => {
      outputString += String(data);
      setShellOutput(outputString);
    });

    command.stderr.on('data', (data) => {
      setShellOutput(data);
    });

    command.on('error', (error) => {
      setShellOutput(error);
      setIsRunningShell(false);
    });

    command.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      setIsRunningShell(false);
    });
  };

  const installPackage = async (dep) => {
    setIsRunningShell(true);
    setInstallingPackage(dep);
    let output = '';
    await pipInstallWithProgress(
      pythonKeys.python,
      dep,
      (percentage) => {
        setProgress(percentage);
      },
      (data) => {
        output += String(data);
        setShellOutput(output);
      }
    );
    setIsRunningShell(false);
    setProgress(0);
  };

  const updatePackage = async (dep) => {
    setIsRunningShell(true);
    setInstallingPackage(dep);
    let output = '';
    await pipInstallWithProgress(
      pythonKeys.python,
      dep,
      (percentage) => {
        setProgress(percentage);
      },
      (data) => {
        output += String(data);
        setShellOutput(output);
      },
      true
    );
    setIsRunningShell(false);
    setProgress(0);
  };

  const uninstallPackage = (dep) => {
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
                    {`GPU (${
                      isNvidiaAvailable ? nvidiaGpuName : gpuInfo[0] ?? 'No GPU Available'
                    })`}
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
                    {`Python (${deps.pythonVersion}) [${isSystemPython ? 'System' : 'Integrated'}]`}
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
                          color={pipList[dep.packageName] ? 'inherit' : 'red.500'}
                          flex="1"
                          textAlign="left"
                        >
                          {`${dep.name} (${
                            pipList[dep.packageName] ? pipList[dep.packageName] : 'not installed'
                          })`}
                        </Text>
                        {pipList[dep.packageName] ? (
                          <HStack>
                            <Button
                              colorScheme="blue"
                              disabled={
                                checkSemver(dep.version, pipList[dep.packageName]) || isRunningShell
                              }
                              isLoading={isRunningShell}
                              leftIcon={<DownloadIcon />}
                              size="sm"
                              onClick={async () => {
                                setDepChanged(true);
                                await updatePackage(dep);
                              }}
                            >
                              {`Update${
                                !checkSemver(dep.version, pipList[dep.packageName])
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
                            onClick={async () => {
                              setDepChanged(true);
                              await installPackage(dep);
                            }}
                          >
                            Install
                          </Button>
                        )}
                      </Flex>
                      {isRunningShell && installingPackage?.name === dep.name && (
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
                          backgroundColor: useColorModeValue('gray.300', 'gray.600'),
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
              onClick={async () => {
                await ipcRenderer.invoke('relaunch-application');
              }}
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
              {`Are you sure you want to uninstall ${uninstallingPackage.name}?`}
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
                  uninstallPackage(uninstallingPackage);
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
  const [pipList, setPipList] = useState({});

  const [availableDeps, setAvailableDeps] = useState([]);
  const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const hasNvidia = await ipcRenderer.invoke('get-has-nvidia');
      if (hasNvidia) {
        setIsNvidiaAvailable(await ipcRenderer.invoke('get-has-nvidia'));
      }
    })();
  }, []);

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
        onOpen={onOpen}
        onPipListUpdate={useCallback((pipObj) => setPipList(pipObj), [setPipList])}
      />
    </>
  );
});

export default memo(DependencyManager);
