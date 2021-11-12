/* eslint-disable import/extensions */
import {
  HamburgerIcon, LinkIcon, MoonIcon, SunIcon,
} from '@chakra-ui/icons';
import {
  Box, Flex, Heading, HStack, IconButton, Menu, MenuButton,
  MenuDivider, MenuItem, MenuList, Portal, Spacer, Tag, useColorMode,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, { useContext } from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import useFetch from 'use-http';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';

function Header() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { convertToUsableFormat, useAnimateEdges } = useContext(GlobalContext);
  const [animateEdges, unAnimateEdges] = useAnimateEdges();
  const { post } = useFetch(`http://localhost:${ipcRenderer.sendSync('get-port')}/run`, {
    cachePolicy: 'no-cache',
  });

  async function run() {
    animateEdges();
    const data = convertToUsableFormat();
    const response = await post(data);
    console.log(response);
    unAnimateEdges();
  }

  return (
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
              <MenuDivider />
              <MenuItem onClick={() => alert('This would quit the application')}>Quit Application</MenuItem>
            </MenuList>
          </Portal>
        </Menu>
      </Flex>
    </Box>
  );
}

export default Header;
