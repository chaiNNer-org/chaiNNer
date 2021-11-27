/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { DeleteIcon, DownloadIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import {
  AlertDialog,
  AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Button, Flex,
  HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Spinner, Text, Textarea, useDisclosure, VStack, StackDivider,
} from '@chakra-ui/react';
import { exec, spawn } from 'child_process';
import { ipcRenderer, shell } from 'electron';
import React, {
  memo, useEffect, useRef, useState,
} from 'react';

function DependencyManager({ isOpen, onClose }) {
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

  const [shellOutput, setShellOutput] = useState('');
  const [isRunningShell, setIsRunningShell] = useState(false);

  const [depChanged, setDepChanged] = useState(false);

  const [gpuInfo, setGpuInfo] = useState([]);
  const [isNvidiaAvailable, setIsNvidiaAvailable] = useState(false);
  const [nvidiaGpuName, setNvidiaGpuName] = useState(null);

  useEffect(async () => {
    const fullGpuInfo = await ipcRenderer.invoke('get-gpu-info');
    const gpuNames = fullGpuInfo?.controllers.map((gpu) => gpu.model);
    setGpuInfo(gpuNames);
    // Check if gpu string contains any nvidia-specific terms
    const nvidiaGpu = gpuNames.find(
      (gpu) => gpu.toLowerCase().split(' ').some(
        (item) => ['nvidia', 'geforce', 'gtx', 'rtx'].includes(item),
      ),
    );
    setNvidiaGpuName(nvidiaGpu);
    setIsNvidiaAvailable(!!nvidiaGpu);
  }, []);

  // TODO: Make this not hardcoded
  const availableDeps = [{
    name: 'OpenCV',
    packageName: 'opencv-python',
    installCommand: 'pip install opencv-python',
  }, {
    name: 'NumPy',
    packageName: 'numpy',
    installCommand: 'pip install numpy',
  }, {
    name: 'PyTorch',
    packageName: 'torch',
    installCommand: `pip install torch==1.10.0+${isNvidiaAvailable ? 'cu113' : 'cpu'} -f https://download.pytorch.org/whl/${isNvidiaAvailable ? 'cu113' : 'cpu'}/torch_stable.html`,
  }];

  useEffect(() => {
    const pKeys = ipcRenderer.sendSync('get-python');
    setPythonKeys(pKeys);
    setDeps({
      ...deps,
      pythonVersion: pKeys.version,
    });
    exec(`${pKeys.pip} list`, (error, stdout, stderr) => {
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
      exec(`${pythonKeys.pip} list --outdated`, (error, stdout, stderr) => {
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

  const installPackage = (installCommand) => {
    setShellOutput('');
    setIsRunningShell(true);
    const args = installCommand.split(' ');
    const installer = args.shift();
    let command = '';
    if (installer === 'pip') {
      command = spawn(pythonKeys.pip, args);
    } else {
      command = spawn(installer, args);
    }

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

  const updatePackage = (packageName) => {
    setShellOutput('');
    setIsRunningShell(true);
    const command = spawn(pythonKeys.pip, ['install', '--upgrade', packageName]);

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

  const uninstallPackage = (packageName) => {
    const packageDep = availableDeps.find(
      (dep) => dep.name === packageName || dep.packageName === packageName,
    );
    setShellOutput('');
    setIsRunningShell(true);
    const args = packageDep.installCommand.split(' ');
    const installer = args.shift();
    let command = '';
    if (installer === 'pip') {
      command = spawn(pythonKeys.pip, ['uninstall', '-y', packageDep.packageName]);
    } else {
      return;
    }

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
                  {/* <HStack>
                    <Button
                      colorScheme="blue"
                      onClick={() => {
                        shell.openExternal('https://www.python.org/downloads/');
                      }}
                      size="sm"
                    // disabled
                      leftIcon={<ExternalLinkIcon />}
                    >
                      Check for Updates
                    </Button>
                  </HStack> */}
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
              <Textarea disabled placeholder="Console output..." w="full" h="150" value={shellOutput} fontFamily="monospace" />
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
}

export default memo(DependencyManager);
