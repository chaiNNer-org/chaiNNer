/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { DeleteIcon, DownloadIcon } from '@chakra-ui/icons';
import {
  AlertDialog,
  AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Button, Flex,
  HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Spinner, StackDivider, Text, Textarea, useDisclosure, VStack,
} from '@chakra-ui/react';
import { exec, spawn } from 'child_process';
import { ipcRenderer } from 'electron';
import React, {
  memo, useEffect, useRef, useState,
} from 'react';
import getAvailableDeps from '../helpers/dependencies.js';

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

  const [isCheckingUpdates, setIsCheckingUpdates] = useState(true);
  const [pipUpdateList, setPipUpdateList] = useState({});

  const [uninstallingPackage, setUninstallingPackage] = useState('');

  const consoleRef = useRef(null);
  const [shellOutput, setShellOutput] = useState('');
  const [isRunningShell, setIsRunningShell] = useState(false);

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
      exec(`${pythonKeys.pip} list`, (error, stdout, stderr) => {
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
    if (pipList && Object.keys(pipList).length) {
      setIsCheckingUpdates(true);
      exec(`${pythonKeys.python} -m pip list --outdated`, (error, stdout, stderr) => {
        if (error) {
          console.log(error, stderr);
          setIsCheckingUpdates(false);
          return;
        }
        const tempPipList = String(stdout).split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
        const pipObj = {};
        tempPipList.forEach(([dep, version, newVersion]) => {
          pipObj[dep] = newVersion;
        });
        setPipUpdateList(pipObj);
        setIsCheckingUpdates(false);
      });
    }
  }, [pythonKeys, pipList]);

  useEffect(async () => {
    if (depChanged) {
      await ipcRenderer.invoke('kill-backend');
    }
  }, [depChanged]);

  const runPipCommand = (args) => {
    setShellOutput('');
    setIsRunningShell(true);
    const command = spawn(pythonKeys.python, ['-m', 'pip', ...args]);

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
    });

    command.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
      setIsRunningShell(false);
    });
  };

  const installPackage = (installCommand) => {
    const args = installCommand.split(' ');
    const installer = args.shift();
    if (installer === 'pip') {
      runPipCommand(args);
    }
  };

  const updatePackage = (packageName) => {
    runPipCommand(['install', '--upgrade', packageName]);
  };

  const uninstallPackage = (packageName) => {
    const packageDep = availableDeps.find(
      (dep) => dep.name === packageName || dep.packageName === packageName,
    );
    const args = packageDep.installCommand.split(' ');
    const installer = args.shift();
    if (installer === 'pip') {
      runPipCommand(['uninstall', '-y', packageDep.packageName]);
    }
  };

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [shellOutput]);

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
                    <Flex align="center" w="full" key={dep.name}>
                      {/* <Text>{`Installed version: ${dep.version ?? 'None'}`}</Text> */}
                      <Text flex="1" textAlign="left" color={pipList[dep.packageName] ? 'inherit' : 'red.500'}>
                        {`${dep.name} (${pipList[dep.packageName] ? pipList[dep.packageName] : 'not installed'})`}
                      </Text>
                      {pipList[dep.packageName] ? (
                        <HStack>
                          <Button
                            colorScheme="blue"
                            onClick={() => {
                              setDepChanged(true);
                              updatePackage(dep.packageName);
                            }}
                            size="sm"
                            disabled={isCheckingUpdates
                                || !pipUpdateList[dep.packageName]
                                || isRunningShell}
                            isLoading={isCheckingUpdates}
                            leftIcon={<DownloadIcon />}
                          >
                            {`Update${pipUpdateList[dep.packageName] ? ` (${pipUpdateList[dep.packageName]})` : ''}`}
                          </Button>
                          <Button
                            colorScheme="red"
                            onClick={() => {
                              setUninstallingPackage(dep.name);
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
                            onClick={() => {
                              setDepChanged(true);
                              installPackage(dep.installCommand);
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
                  ))}
              </VStack>
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
              {`Are you sure you want to uninstall ${uninstallingPackage}?`}
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
