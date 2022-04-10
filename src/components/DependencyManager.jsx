/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { DeleteIcon, DownloadIcon } from '@chakra-ui/icons';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, Center, Flex, HStack, IconButton, Modal,
  ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Progress, Spinner, StackDivider, Tag,
  TagLabel, Text, Textarea, Tooltip, useColorModeValue, useDisclosure, VStack,
} from '@chakra-ui/react';
import { exec, spawn } from 'child_process';
import { ipcRenderer } from 'electron';
import React, {
  memo, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
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
  const {
    useIsSystemPython,
  } = useContext(SettingsContext);

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
      exec(`${pKeys.python} -m pip list --disable-pip-version-check`, (error, stdout, stderr) => {
        if (error) {
          setIsLoadingPipList(false);
          return;
        }
        const tempPipList = String(stdout).split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
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
      exec(`${pythonKeys.python} -m pip list --disable-pip-version-check`, (error, stdout, stderr) => {
        if (error || stderr) {
          setIsLoadingPipList(false);
          return;
        }
        const tempPipList = String(stdout).split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
        const pipObj = {};
        tempPipList.forEach(([dep, version]) => {
          pipObj[dep] = version;
        });
        setPipList(pipObj);
        onPipListUpdate(pipObj);
        setIsLoadingPipList(false);
      });
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
    await pipInstallWithProgress(pythonKeys.python, dep,
      (percentage) => {
        setProgress(percentage);
      },
      (data) => {
        output += String(data);
        setShellOutput(output);
      });
    setIsRunningShell(false);
    setProgress(0);
  };

  const updatePackage = async (dep) => {
    setIsRunningShell(true);
    setInstallingPackage(dep);
    let output = '';
    await pipInstallWithProgress(pythonKeys.python, dep,
      (percentage) => {
        setProgress(percentage);
      },
      (data) => {
        output += String(data);
        setShellOutput(output);
      }, true);
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
        isOpen={isOpen}
        onClose={onClose}
        isCentered
        scrollBehavior="inside"
        size="xl"
        closeOnOverlayClick={!depChanged}
        returnFocusOnClose={false}
      >
        <ModalOverlay cursor={depChanged ? 'disabled' : 'default'} />
        <ModalContent maxW="750px">
          <ModalHeader>
            Dependency Manager
          </ModalHeader>
          <ModalCloseButton disabled={depChanged} />
          <ModalBody>
            <VStack w="full" divider={<StackDivider />}>
              <VStack w="full" divider={<StackDivider />}>
                <Flex align="center" w="full">
                  <Text flex="1" textAlign="left" color={isNvidiaAvailable ? 'inherit' : 'red.500'}>
                    {`GPU (${isNvidiaAvailable ? nvidiaGpuName : gpuInfo[0] ?? 'No GPU Available'})`}
                  </Text>
                </Flex>
                <Flex align="center" w="full">
                  <Text flex="1" textAlign="left">
                    {`Python (${deps.pythonVersion}) [${isSystemPython ? 'System' : 'Integrated'}]`}
                  </Text>
                </Flex>
                {isLoadingPipList ? <Spinner />
                  : availableDeps.map((dep) => (
                    <VStack w="full" key={dep.name}>
                      <Flex align="center" w="full" key={dep.name}>
                        {/* <Text>{`Installed version: ${dep.version ?? 'None'}`}</Text> */}
                        <Text flex="1" textAlign="left" color={pipList[dep.packageName] ? 'inherit' : 'red.500'}>
                          {`${dep.name} (${pipList[dep.packageName] ? pipList[dep.packageName] : 'not installed'})`}
                        </Text>
                        {pipList[dep.packageName] ? (
                          <HStack>
                            <Button
                              colorScheme="blue"
                              onClick={async () => {
                                setDepChanged(true);
                                await updatePackage(dep);
                              }}
                              size="sm"
                              disabled={checkSemver(dep.version, pipList[dep.packageName])
                              || isRunningShell}
                              isLoading={isRunningShell}
                              leftIcon={<DownloadIcon />}
                            >
                              {`Update${!checkSemver(dep.version, pipList[dep.packageName]) ? ` (${dep.version})` : ''}`}
                            </Button>
                            <Button
                              colorScheme="red"
                              onClick={() => {
                                setUninstallingPackage(dep);
                                onUninstallOpen();
                              }}
                              size="sm"
                              leftIcon={<DeleteIcon />}
                              disabled={isRunningShell}
                            >
                              Uninstall
                            </Button>
                          </HStack>
                        )
                          : (
                            <Button
                              colorScheme="blue"
                              onClick={async () => {
                                setDepChanged(true);
                                await installPackage(dep);
                              }}
                              size="sm"
                              leftIcon={<DownloadIcon />}
                              disabled={isRunningShell}
                              isLoading={isRunningShell}
                            >
                              Install
                            </Button>
                          )}
                      </Flex>
                      {isRunningShell && installingPackage?.name === dep.name && (
                        <Center h={8} w="full">
                          <Progress w="full" hasStripe value={progress} />
                        </Center>
                      )}
                    </VStack>
                  ))}
              </VStack>
              <Accordion w="full" allowToggle>
                <AccordionItem>
                  <h2>
                    <AccordionButton>
                      <Box flex="1" textAlign="left">
                        Console Output
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel pb={4}>
                    <Textarea
                      placeholder=""
                      w="full"
                      h="150"
                      value={shellOutput}
                      fontFamily="monospace"
                      cursor="default"
                      ref={consoleRef}
                      onClick={(e) => e.preventDefault()}
                      onChange={(e) => e.preventDefault()}
                      onFocus={(e) => e.preventDefault()}
                      readOnly
                      overflowY="scroll"
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
                    />
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose} disabled={depChanged}>
              Close
            </Button>
            <Button
              variant="ghost"
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
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Uninstall
            </AlertDialogHeader>

            <AlertDialogBody>
              {`Are you sure you want to uninstall ${uninstallingPackage.name}?`}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onUninstallClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={() => {
                  setDepChanged(true);
                  onUninstallClose();
                  uninstallPackage(uninstallingPackage);
                }}
                ml={3}
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
    () => availableDeps.filter(
      ({ packageName, version }) => {
        if (Object.keys(pipList).length === 0) {
          return false;
        }
        if (!pipList[packageName]) {
          return true;
        }
        return !checkSemver(version, pipList[packageName]);
      },
    ),
    [availableDeps, pipList, isNvidiaAvailable],
  );

  return (
    <>
      <Tooltip
        label="Manage Dependencies"
        borderRadius={8}
        py={1}
        px={2}
        closeOnClick
        closeOnMouseDown
      >
        <VStack
          m={0}
          spacing={0}
        >
          {availableUpdates.length ? (
            <Tag
              borderRadius="full"
              colorScheme="red"
              size="sm"
              mt={-1}
              ml={-7}
              position="fixed"
            >
              <TagLabel
                textAlign="center"
              >
                {availableUpdates.length}
              </TagLabel>
            </Tag>
          ) : <></>}
          <IconButton icon={<DownloadIcon />} onClick={onOpen} variant="outline" size="md" position="relative" />
        </VStack>
      </Tooltip>
      <DependencyManager
        isOpen={isOpen}
        onOpen={onOpen}
        onClose={onClose}
        onPipListUpdate={useCallback((pipObj) => setPipList(pipObj), [setPipList])}
      />
    </>
  );
});

export default memo(DependencyManager);
