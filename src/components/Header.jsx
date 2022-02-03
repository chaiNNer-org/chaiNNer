/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  DownloadIcon, HamburgerIcon, MoonIcon, SettingsIcon, SunIcon,
} from '@chakra-ui/icons';
import {
  AlertDialog,
  AlertDialogBody, AlertDialogCloseButton, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, CircularProgress,
  CircularProgressLabel, Flex, Heading, HStack, IconButton,
  Image, Menu, MenuButton, MenuItem, MenuList,
  Portal, Spacer, Tag, Tooltip, useColorMode, useColorModeValue, useDisclosure,
} from '@chakra-ui/react';
import { useEventSource, useEventSourceListener } from '@react-nano/use-event-source';
import { clipboard, ipcRenderer } from 'electron';
import log from 'electron-log';
import React, {
  memo, useContext, useEffect, useState,
} from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import useFetch from 'use-http';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';
import useSystemUsage from '../helpers/hooks/useSystemUsage.js';
import logo from '../public/icons/png/256x256.png';
import DependencyManager from './DependencyManager.jsx';
import SettingsModal from './SettingsModal.jsx';

const Header = ({ port }) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const {
    convertToUsableFormat,
    useAnimateEdges,
    useNodeValidity,
    nodes,
    useIsCpu,
    useIsFp16,
  } = useContext(GlobalContext);

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

  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose,
  } = useDisclosure();

  const [appVersion, setAppVersion] = useState('#.#.#');
  useEffect(async () => {
    const version = await ipcRenderer.invoke('get-app-version');
    setAppVersion(version);
  }, []);

  const { cpuUsage, ramUsage, vramUsage } = useSystemUsage(2500);

  async function run() {
    setRunning(true);
    animateEdges();
    if (nodes.length === 0) {
      setErrorMessage('There are no nodes to run.');
      onErrorOpen();
    } else {
      const invalidNodes = nodes.filter((node) => {
        const [valid] = useNodeValidity(node.id);
        return !valid;
      });
      if (invalidNodes.length === 0) {
        try {
          const data = convertToUsableFormat();
          post('/run', {
            data,
            isCpu,
            isFp16: isFp16 && !isCpu,
            resolutionX: window.screen.width * window.devicePixelRatio,
            resolutionY: window.screen.height * window.devicePixelRatio,
          });
        } catch (err) {
          setErrorMessage(err.exception);
          onErrorOpen();
          unAnimateEdges();
          setRunning(false);
        }
      } else {
        setErrorMessage('There are invalid nodes in the editor. Please fix them before running.');
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
        setErrorMessage(response.exception);
        onErrorOpen();
      }
    } catch (err) {
      setErrorMessage(err.exception);
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
        setErrorMessage(response.exception);
        onErrorOpen();
      }
    } catch (err) {
      setErrorMessage(err.exception);
      onErrorOpen();
      unAnimateEdges();
      setRunning(false);
    }
  }

  return (
    <>
      <Box w="100%" h="56px" borderWidth="1px" borderRadius="lg">
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
            <Tooltip label={`${Number(cpuUsage).toFixed(1)}%`}>
              <Box>
                <CircularProgress
                  value={cpuUsage}
                  color={cpuUsage < 90 ? 'blue.400' : 'red.400'}
                  size="42px"
                  capIsRound
                  trackColor={useColorModeValue('gray.300', 'gray.700')}
                >
                  <CircularProgressLabel>CPU</CircularProgressLabel>
                </CircularProgress>
              </Box>
            </Tooltip>

            <Tooltip label={`${Number(ramUsage).toFixed(1)}%`}>
              <Box>
                <CircularProgress
                  value={ramUsage}
                  color={ramUsage < 90 ? 'blue.400' : 'red.400'}
                  size="42px"
                  capIsRound
                  trackColor={useColorModeValue('gray.300', 'gray.700')}
                >
                  <CircularProgressLabel>RAM</CircularProgressLabel>
                </CircularProgress>
              </Box>
            </Tooltip>

            <Tooltip label={`${Number(vramUsage).toFixed(1)}%`}>
              <Box>
                <CircularProgress
                  value={vramUsage}
                  color={vramUsage < 90 ? 'blue.400' : 'red.400'}
                  size="42px"
                  capIsRound
                  trackColor={useColorModeValue('gray.300', 'gray.700')}
                >
                  <CircularProgressLabel>VRAM</CircularProgressLabel>
                </CircularProgress>
              </Box>
            </Tooltip>

            <Menu isLazy>
              <MenuButton as={IconButton} icon={<HamburgerIcon />} variant="outline" size="md">
                Settings
              </MenuButton>
              <Portal>
                <MenuList>
                  <MenuItem icon={colorMode === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={() => toggleColorMode()}>
                    Toggle Theme
                  </MenuItem>
                  <MenuItem icon={<DownloadIcon />} onClick={onOpen}>
                    Manage Dependencies
                  </MenuItem>
                  <MenuItem icon={<SettingsIcon />} onClick={onSettingsOpen}>
                    Settings
                  </MenuItem>
                </MenuList>
              </Portal>
            </Menu>
          </HStack>
        </Flex>
      </Box>

      <DependencyManager
        isOpen={isOpen}
        onOpen={onOpen}
        onClose={onClose}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onOpen={onSettingsOpen}
        onClose={onSettingsClose}
      />

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
          <AlertDialogBody>
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
