/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { DeleteIcon, DownloadIcon } from '@chakra-ui/icons';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, Center, Flex, HStack, Modal,
  ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Progress, Spinner, StackDivider, Text, Textarea, useDisclosure, VStack,
} from '@chakra-ui/react';
import { exec, spawn } from 'child_process';
import { ipcRenderer } from 'electron';
import React, {
  memo, useEffect, useRef, useState,
} from 'react';
import semver from 'semver';
import getAvailableDeps from '../helpers/dependencies.js';
import pipInstallWithProgress from '../helpers/pipInstallWithProgress.js';

const DependencyManager = ({ isOpen, onClose }) => {
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

  useEffect(async () => {
    const hasNvidia = await ipcRenderer.invoke('get-has-nvidia');
    if (hasNvidia) {
      setNvidiaGpuName(await ipcRenderer.invoke('get-gpu-name'));
      setIsNvidiaAvailable(await ipcRenderer.invoke('get-has-nvidia'));
    } else {
      const fullGpuInfo = await ipcRenderer.invoke('get-gpu-info');
      const gpuNames = fullGpuInfo?.controllers.map((gpu) => gpu.model);
      setGpuInfo(gpuNames);
    }
  }, []);

  useEffect(() => {
    const pKeys = ipcRenderer.sendSync('get-python');
    setPythonKeys(pKeys);
    setDeps({
      ...deps,
      pythonVersion: pKeys.version,
    });
    exec(`${pKeys.python} -m pip list`, (error, stdout, stderr) => {
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
      setIsLoadingPipList(false);
    });
  }, []);

  useEffect(() => {
    if (!isRunningShell) {
      setIsLoadingPipList(true);
      exec(`${pythonKeys.python} -m pip list`, (error, stdout, stderr) => {
        if (error || stderr) {
          return;
        }
        const tempPipList = String(stdout).split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
        const pipObj = {};
        tempPipList.forEach(([dep, version]) => {
          pipObj[dep] = version;
        });
        setPipList(pipObj);
        setIsLoadingPipList(false);
      });
    }
  }, [isRunningShell, pythonKeys]);

  useEffect(async () => {
    if (depChanged) {
      await ipcRenderer.invoke('kill-backend');
    }
  }, [depChanged]);

  const runPipCommand = (args) => {
    setShellOutput('');
    setIsRunningShell(true);
    const command = spawn(pythonKeys.python, ['-m', 'pip', ...args, '--no-cache-dir']);

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
    // let args = ['install', `${dep.packageName}==${dep.version}`];
    // if (dep.findLink) {
    //   args = [
    //     ...args,
    //     '-f',
    //     dep.findLink,
    //   ];
    // }
    // runPipCommand(args);
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
    // let args = ['install', '--upgrade', `${dep.packageName}==${dep.version}`];
    // if (dep.findLink) {
    //   args = [
    //     ...args,
    //     '-f',
    //     dep.findLink,
    //   ];
    // }
    // runPipCommand(args);
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

  const checkSemver = (v1, v2) => {
    try {
      return !semver.gt(semver.coerce(v1).version, semver.coerce(v2).version);
    } catch (error) {
      console.log(error);
      return true;
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside" size="xl" closeOnOverlayClick={!depChanged}>
        <ModalOverlay cursor={depChanged ? 'disabled' : 'default'} />
        <ModalContent maxW="750px">
          <ModalHeader>Dependency Manager</ModalHeader>
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
                    {`Python (${deps.pythonVersion})`}
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
                      placeholder="Console output..."
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
              onClick={() => {
                ipcRenderer.invoke('relaunch-application');
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

export default memo(DependencyManager);
