import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Image,
  Spacer,
  Tag,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import { clipboard } from 'electron';
import { memo, useContext, useEffect, useRef, useState } from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import { useThrottledCallback } from 'use-debounce';
import { ipcRenderer } from '../helpers/safeIpc';
import checkNodeValidity from '../helpers/checkNodeValidity';
import { GlobalContext } from '../helpers/contexts/GlobalNodeState';
import { SettingsContext } from '../helpers/contexts/SettingsContext';
import logo from '../public/icons/png/256x256.png';
import { DependencyManagerButton } from './DependencyManager';
import { SettingsButton } from './SettingsModal';
import SystemStats from './SystemStats';
import {
  BackendEventSourceListener,
  useBackendEventSource,
  useBackendEventSourceListener,
} from '../helpers/hooks/useBackendEventSource';
import { getBackend } from '../helpers/Backend';

interface HeaderProps {
  port: number;
}

const Header = ({ port }: HeaderProps) => {
  const {
    convertToUsableFormat,
    useAnimateEdges,
    nodes,
    edges,
    availableNodes,
    setIteratorPercent,
  } = useContext(GlobalContext);

  const { useIsCpu, useIsFp16 } = useContext(SettingsContext);

  const [isCpu] = useIsCpu;
  const [isFp16] = useIsFp16;

  const [animateEdges, unAnimateEdges, completeEdges, clearCompleteEdges] = useAnimateEdges();

  const [running, setRunning] = useState(false);
  const backend = getBackend(port);

  useEffect(() => {
    if (!running) {
      unAnimateEdges();
    }
  }, [running]);

  const { isOpen: isErrorOpen, onOpen: onErrorOpen, onClose: onErrorClose } = useDisclosure();
  const [errorMessage, setErrorMessage] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  const [eventSource, eventSourceStatus] = useBackendEventSource(port);

  useBackendEventSourceListener(
    eventSource,
    'finish',
    () => {
      clearCompleteEdges();
      setRunning(false);
    },
    [setRunning, clearCompleteEdges]
  );

  useBackendEventSourceListener(
    eventSource,
    'execution-error',
    (data) => {
      if (data) {
        setErrorMessage(data.exception);
        onErrorOpen();
        unAnimateEdges();
        setRunning(false);
      }
    },
    [setRunning, unAnimateEdges]
  );

  const updateNodeFinish = useThrottledCallback<BackendEventSourceListener<'node-finish'>>(
    (data) => {
      if (data) {
        completeEdges(data.finished);
      }
    },
    350
  );
  useBackendEventSourceListener(eventSource, 'node-finish', updateNodeFinish, [
    completeEdges,
    updateNodeFinish,
  ]);

  const updateIteratorProgress = useThrottledCallback<
    BackendEventSourceListener<'iterator-progress-update'>
  >((data) => {
    if (data) {
      const { percent, iteratorId, running: runningNodes } = data;
      if (runningNodes && running) {
        animateEdges(runningNodes);
      } else if (!running) {
        unAnimateEdges();
      }
      setIteratorPercent(iteratorId, percent);
    }
  }, 350);
  useBackendEventSourceListener(eventSource, 'iterator-progress-update', updateIteratorProgress, [
    animateEdges,
    updateIteratorProgress,
  ]);

  useEffect(() => {
    if (eventSourceStatus === 'error') {
      setErrorMessage('An unexpected error occurred. You may need to restart chaiNNer.');
      onErrorOpen();
      unAnimateEdges();
      setRunning(false);
    }
  }, [eventSourceStatus]);

  const [appVersion, setAppVersion] = useState('#.#.#');
  useEffect(() => {
    (async () => {
      const version = await ipcRenderer.invoke('get-app-version');
      setAppVersion(version);
    })();
  }, []);

  const run = async () => {
    setRunning(true);
    animateEdges();
    if (nodes.length === 0) {
      setErrorMessage('There are no nodes to run.');
      onErrorOpen();
    } else {
      const nodeValidities = nodes.map((node) => {
        const { inputs } = availableNodes[node.data.category][node.data.type];
        return [
          ...checkNodeValidity({ id: node.id, inputData: node.data.inputData, edges, inputs }),
          node.data.type,
        ] as const;
      });
      const invalidNodes = nodeValidities.filter(([isValid]) => !isValid);
      if (invalidNodes.length > 0) {
        const reasons = invalidNodes.map(([, reason, type]) => `• ${type}: ${reason}`).join('\n');
        setErrorMessage(
          `There are invalid nodes in the editor. Please fix them before running.\n${reasons}`
        );
        onErrorOpen();
        unAnimateEdges();
        setRunning(false);
        return;
      }
      try {
        const data = convertToUsableFormat();
        const response = await backend.run({
          data,
          isCpu,
          isFp16: isFp16 && !isCpu,
          // We actually do not want to adjust for scaling here,
          // as imshow does not take that into account
          // resolutionX: Math.floor(window.screen.width * window.devicePixelRatio),
          // resolutionY: Math.floor(window.screen.height * window.devicePixelRatio),
          resolutionX: window.screen.width,
          resolutionY: window.screen.height,
        });
        if (response.exception) {
          setErrorMessage(response.exception);
          onErrorOpen();
          unAnimateEdges();
          setRunning(false);
        }
      } catch (err) {
        setErrorMessage('An unexpected error occurred.');
        onErrorOpen();
        unAnimateEdges();
        setRunning(false);
      }
    }
  };

  const pause = async () => {
    try {
      const response = await backend.pause();
      if (response.exception) {
        setErrorMessage(response.exception);
        onErrorOpen();
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred.');
      onErrorOpen();
    }
    setRunning(false);
    unAnimateEdges();
  };

  const kill = async () => {
    try {
      const response = await backend.kill();
      clearCompleteEdges();
      if (response.exception) {
        setErrorMessage(response.exception);
        onErrorOpen();
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred.');
      onErrorOpen();
    }
    unAnimateEdges();
    setRunning(false);
  };

  return (
    <>
      <Box
        bg={useColorModeValue('gray.100', 'gray.800')}
        borderRadius="lg"
        borderWidth="1px"
        h="56px"
        w="100%"
      >
        <Flex
          align="center"
          h="100%"
          p={2}
        >
          <HStack>
            {/* <LinkIcon /> */}
            <Image
              boxSize="36px"
              draggable={false}
              src={logo}
            />
            <Heading size="md">chaiNNer</Heading>
            <Tag>Alpha</Tag>
            <Tag>{`v${appVersion}`}</Tag>
          </HStack>
          <Spacer />

          <HStack>
            <IconButton
              aria-label="Start button"
              colorScheme="green"
              disabled={running}
              icon={<IoPlay />}
              size="md"
              variant="outline"
              onClick={() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                run();
              }}
            />
            <IconButton
              aria-label="Pause button"
              colorScheme="yellow"
              disabled={!running}
              icon={<IoPause />}
              size="md"
              variant="outline"
              onClick={() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                pause();
              }}
            />
            <IconButton
              aria-label="Stop button"
              colorScheme="red"
              disabled={!running}
              icon={<IoStop />}
              size="md"
              variant="outline"
              onClick={() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                kill();
              }}
            />
          </HStack>
          <Spacer />
          <HStack>
            <SystemStats />
            <DependencyManagerButton />
            <SettingsButton />
          </HStack>
        </Flex>
      </Box>

      <AlertDialog
        isCentered
        isOpen={isErrorOpen}
        leastDestructiveRef={cancelRef}
        onClose={onErrorClose}
      >
        <AlertDialogOverlay />

        <AlertDialogContent>
          <AlertDialogHeader>Error</AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody whiteSpace="pre-wrap">{errorMessage}</AlertDialogBody>
          <AlertDialogFooter>
            <HStack>
              <Button
                onClick={() => {
                  clipboard.writeText(errorMessage);
                }}
              >
                Copy to Clipboard
              </Button>
              <Button
                ref={cancelRef}
                onClick={onErrorClose}
              >
                OK
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default memo(Header);
