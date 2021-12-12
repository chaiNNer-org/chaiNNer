/* eslint-disable import/extensions */
import {
  DownloadIcon, HamburgerIcon, MoonIcon, SettingsIcon, SunIcon,
} from '@chakra-ui/icons';
import {
  AlertDialog,
  AlertDialogBody, AlertDialogCloseButton, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, Flex, Heading, HStack,
  IconButton, Image, Menu, MenuButton, MenuItem,
  MenuList, Portal, Spacer, Tag, useColorMode, useDisclosure,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, {
  memo, useContext, useEffect, useState,
} from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import useFetch from 'use-http';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';
import useInterval from '../helpers/useInterval.js';
import logo from '../public/icons/png/256x256.png';
import DependencyManager from './DependencyManager.jsx';
import SettingsModal from './SettingsModal.jsx';

function Header() {
  const [monitor, setMonitor] = useState(null);

  useEffect(async () => {
    const { displays } = await ipcRenderer.invoke('get-gpu-info');
    if (displays) {
      const mainDisplay = displays.find((display) => display.main === true);
      setMonitor(mainDisplay);
    }
  }, []);

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
  const { post, error, response: res } = useFetch(`http://localhost:${ipcRenderer.sendSync('get-port')}/run`, {
    cachePolicy: 'no-cache',
  });

  const { post: checkPost, error: checkError, response: checkRes } = useFetch(`http://localhost:${ipcRenderer.sendSync('get-port')}/check`, {
    cachePolicy: 'no-cache',
  });

  useInterval(async () => {
    if (running) {
      const response = await checkPost();
      if (checkRes.ok) {
        if (response.finished) {
          completeEdges(response.finished);
        }
      }
    }
  }, 500);

  const { post: killPost, error: killError, response: killRes } = useFetch(`http://localhost:${ipcRenderer.sendSync('get-port')}/kill`, {
    cachePolicy: 'no-cache',
  });

  const { post: pausePost, error: pauseError, response: pauseRes } = useFetch(`http://localhost:${ipcRenderer.sendSync('get-port')}/pause`, {
    cachePolicy: 'no-cache',
  });

  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose,
  } = useDisclosure();

  const { isOpen: isErrorOpen, onOpen: onErrorOpen, onClose: onErrorClose } = useDisclosure();
  const [errorMessage, setErrorMessage] = useState('');
  const cancelRef = React.useRef();

  const [appVersion, setAppVersion] = useState('#.#.#');
  useEffect(async () => {
    const version = await ipcRenderer.invoke('get-app-version');
    setAppVersion(version);
  }, []);

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
          const response = await post({
            data,
            isCpu,
            isFp16: isFp16 && !isCpu,
            resolutionX: monitor?.resolutionX || 1920,
            resolutionY: monitor?.resolutionY || 1080,
          });
          console.log(response);
          if (!res.ok) {
            setErrorMessage(response.exception);
            onErrorOpen();
          }
        } catch (err) {
          setErrorMessage(err.exception);
          onErrorOpen();
        }
      } else {
        setErrorMessage('There are invalid nodes in the editor. Please fix them before running.');
        onErrorOpen();
      }
    }
    unAnimateEdges();
    setRunning(false);
  }

  async function pause() {
    try {
      const response = await pausePost();
      if (!pauseRes.ok) {
        setErrorMessage(response.exception);
        onErrorOpen();
      }
    } catch (err) {
      setErrorMessage(err.exception);
      onErrorOpen();
    }
  }

  async function kill() {
    try {
      const response = await killPost();
      clearCompleteEdges();
      if (!killRes.ok) {
        setErrorMessage(response.exception);
        onErrorOpen();
      }
    } catch (err) {
      setErrorMessage(err.exception);
      onErrorOpen();
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
            <Tag>Pre-Alpha</Tag>
            <Tag>{`v${appVersion}`}</Tag>
          </HStack>
          <Spacer />
          <HStack>
            <IconButton icon={<IoPlay />} variant="outline" size="md" colorScheme="green" onClick={() => { run(); }} disabled={running} />
            <IconButton icon={<IoPause />} variant="outline" size="md" colorScheme="yellow" onClick={() => { pause(); }} disabled={!running} />
            <IconButton icon={<IoStop />} variant="outline" size="md" colorScheme="red" onClick={() => { kill(); }} disabled={!running} />
          </HStack>
          <Spacer />
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
                {/* <MenuDivider /> */}
                {/* <MenuItem onClick={() => {
                  ipcRenderer.invoke('quit-application');
                }}
                >
                  Quit Application

                </MenuItem> */}
              </MenuList>
            </Portal>
          </Menu>
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
            {errorMessage}
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onErrorClose}>
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default memo(Header);
