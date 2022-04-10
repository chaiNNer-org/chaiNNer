/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  AlertDialog,
  AlertDialogBody, AlertDialogCloseButton, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, Flex, Heading, HStack, IconButton,
  Image, Spacer, Tag, useColorModeValue, useDisclosure
} from '@chakra-ui/react';
import { useEventSource, useEventSourceListener } from '@react-nano/use-event-source';
import { clipboard, ipcRenderer } from 'electron';
import log from 'electron-log';
import React, {
  memo, useContext, useEffect, useState
} from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import useFetch from 'use-http';
import checkNodeValidity from '../helpers/checkNodeValidity.js';
import { GlobalContext } from '../helpers/contexts/GlobalNodeState.jsx';
import { SettingsContext } from '../helpers/contexts/SettingsContext.jsx';
import logo from '../public/icons/png/256x256.png';
import { DependencyManagerButton } from './DependencyManager.jsx';
import { SettingsButton } from './SettingsModal.jsx';
import SystemStats from './SystemStats.jsx';

const Header = ({ port }) => {
  const {
    convertToUsableFormat,
    useAnimateEdges,
    nodes,
    edges,
    availableNodes,
    setIteratorPercent,
  } = useContext(GlobalContext);

  const {
    useIsCpu,
    useIsFp16,
  } = useContext(SettingsContext);

  const [isCpu] = useIsCpu;
  const [isFp16] = useIsFp16;

  const [animateEdges, unAnimateEdges, completeEdges, clearCompleteEdges] = useAnimateEdges();

  const [running, setRunning] = useState(false);
  const { post, error, response: res } = useFetch(`http://localhost:${port}`, {
    cachePolicy: 'no-cache',
    timeout: 0,
  });

  const { isOpen: isErrorOpen, onOpen: onErrorOpen, onClose: onErrorClose } = useDisclosure();
  const [errorMessage, setErrorMessage] = useState('');
  const cancelRef = React.useRef();

  const [eventSource, eventSourceStatus] = useEventSource(`http://localhost:${port}/sse`, true);
  useEventSourceListener(eventSource, ['finish'], ({ data }) => {
    try {
      const parsedData = JSON.parse(data);
      // console.log(parsedData);
    } catch (err) {
      log.error(err);
    }
    clearCompleteEdges();
    setRunning(false);
  }, [eventSource, setRunning, clearCompleteEdges]);

  useEventSourceListener(eventSource, ['execution-error'], ({ data }) => {
    if (data) {
      try {
        const { message, exception } = JSON.parse(data);
        if (exception) {
          setErrorMessage(exception ?? message ?? 'An unexpected error has occurred');
        }
      } catch (err) {
        setErrorMessage(err);
        log.error(err);
      }
      onErrorOpen();
      unAnimateEdges();
      setRunning(false);
    }
  }, [eventSource, setRunning, unAnimateEdges]);

  useEventSourceListener(eventSource, ['node-finish'], ({ data }) => {
    try {
      const { finished } = JSON.parse(data);
      if (finished) {
        completeEdges(finished);
      }
    } catch (err) {
      log.error(err);
    }
  }, [eventSource, completeEdges]);

  useEventSourceListener(eventSource, ['iterator-progress-update'], ({ data }) => {
    try {
      const { percent, iteratorId, running: runningNodes } = JSON.parse(data);
      if (runningNodes) {
        unAnimateEdges(runningNodes);
      }
      setIteratorPercent(iteratorId, percent);
    } catch (err) {
      log.error(err);
    }
  }, [eventSource, unAnimateEdges]);

  const [appVersion, setAppVersion] = useState('#.#.#');
  useEffect(() => {
    (async () => {
      const version = await ipcRenderer.invoke('get-app-version');
      setAppVersion(version);
    })();
  }, []);

  async function run() {
    setRunning(true);
    animateEdges();
    if (nodes.length === 0) {
      setErrorMessage('There are no nodes to run.');
      onErrorOpen();
    } else {
      const nodeValidities = nodes.map(
        (node) => {
          const { inputs } = availableNodes[node.data.category][node.data.type];
          return [...checkNodeValidity({
            id: node.id, inputData: node.data.inputData, edges, inputs,
          }), node.data.type];
        },
      );
      const invalidNodes = nodeValidities.filter(([isValid]) => !isValid);
      if (invalidNodes.length > 0) {
        const reasons = invalidNodes.map(([, reason, type]) => `• ${type}: ${reason}`).join('\n');
        setErrorMessage(`There are invalid nodes in the editor. Please fix them before running.\n${reasons}`);
        onErrorOpen();
        unAnimateEdges();
        setRunning(false);
        return;
      }
      try {
        const data = convertToUsableFormat();
        post('/run', {
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
      } catch (err) {
        setErrorMessage(err.exception || 'An unexpected error occurred.');
        onErrorOpen();
        unAnimateEdges();
        setRunning(false);
      }
    }
  }

  async function pause() {
    try {
      const response = await post('/pause');
      setRunning(false);
      unAnimateEdges();
      if (!res.ok) {
        setErrorMessage(response.exception || 'An unexpected error occurred.');
        onErrorOpen();
      }
    } catch (err) {
      setErrorMessage(err.exception || 'An unexpected error occurred.');
      onErrorOpen();
      setRunning(false);
      unAnimateEdges();
    }
  }

  async function kill() {
    try {
      const response = await post('/kill');
      clearCompleteEdges();
      unAnimateEdges();
      setRunning(false);
      if (!res.ok) {
        setErrorMessage(response.exception || 'An unexpected error occurred.');
        onErrorOpen();
      }
    } catch (err) {
      setErrorMessage(err.exception || 'An unexpected error occurred.');
      onErrorOpen();
      unAnimateEdges();
      setRunning(false);
    }
  }

  return (
    <>
      <Box w="100%" h="56px" borderWidth="1px" borderRadius="lg" bg={useColorModeValue('gray.100', 'gray.800')}>
        <Flex align="center" h="100%" p={2}>
          <HStack>
            {/* <LinkIcon /> */}
            <Image boxSize="36px" src={logo} draggable={false} />
            <Heading size="md">
              chaiNNer
            </Heading>
            <Tag>Alpha</Tag>
            <Tag>{`v${appVersion}`}</Tag>
          </HStack>
          <Spacer />

          <HStack>
            <IconButton icon={<IoPlay />} variant="outline" size="md" colorScheme="green" onClick={() => { run(); }} disabled={running} />
            <IconButton icon={<IoPause />} variant="outline" size="md" colorScheme="yellow" onClick={() => { pause(); }} disabled={!running} />
            <IconButton icon={<IoStop />} variant="outline" size="md" colorScheme="red" onClick={() => { kill(); }} disabled={!running} />
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
        leastDestructiveRef={cancelRef}
        onClose={onErrorClose}
        isOpen={isErrorOpen}
        isCentered
      >
        <AlertDialogOverlay />

        <AlertDialogContent>
          <AlertDialogHeader>Error</AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody
            whiteSpace="pre-wrap"
          >
            {String(errorMessage)}
          </AlertDialogBody>
          <AlertDialogFooter>
            <HStack>
              <Button onClick={(() => {
                clipboard.writeText(errorMessage);
              })}
              >
                Copy to Clipboard
              </Button>
              <Button ref={cancelRef} onClick={onErrorClose}>
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
