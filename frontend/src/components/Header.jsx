/* eslint-disable import/extensions */
import {
  DownloadIcon, HamburgerIcon, LinkIcon, MoonIcon, SettingsIcon, SunIcon,
} from '@chakra-ui/icons';
import {
  Box, Flex, Heading, HStack, IconButton, Menu, MenuButton, MenuDivider, MenuItem,
  MenuList, Portal, Spacer, Tag, useColorMode, useDisclosure,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, { memo, useContext } from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import useFetch from 'use-http';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';
import DependencyManager from './DependencyManager.jsx';
import SettingsModal from './SettingsModal.jsx';

function Header() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { convertToUsableFormat, useAnimateEdges } = useContext(GlobalContext);
  const [animateEdges, unAnimateEdges] = useAnimateEdges();
  const { post } = useFetch(`http://localhost:${ipcRenderer.sendSync('get-port')}/run`, {
    cachePolicy: 'no-cache',
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose,
  } = useDisclosure();

  async function run() {
    animateEdges();
    const data = convertToUsableFormat();
    console.log('🚀 ~ file: Header.jsx ~ line 32 ~ run ~ data', JSON.stringify(data));
    const response = await post(data);
    console.log(response);
    unAnimateEdges();
  }

  return (
    <>
      <Box w="100%" h="56px" borderWidth="1px" borderRadius="lg">
        <Flex align="center" h="100%" p={2}>
          <HStack>
            <LinkIcon />
            <Heading size="md">
              chaiNNer
            </Heading>
            <Tag>v0.0.1</Tag>
          </HStack>
          <Spacer />
          <HStack>
            <IconButton icon={<IoPlay />} variant="outline" size="md" colorScheme="green" onClick={() => { run(); }} />
            <IconButton icon={<IoPause />} variant="outline" size="md" colorScheme="yellow" disabled />
            <IconButton icon={<IoStop />} variant="outline" size="md" colorScheme="red" disabled />
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
                <MenuDivider />
                <MenuItem onClick={() => {
                  ipcRenderer.invoke('quit-application');
                }}
                >
                  Quit Application

                </MenuItem>
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
    </>
  );
}

export default memo(Header);
