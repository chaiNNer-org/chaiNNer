import {
  HamburgerIcon, LinkIcon, MoonIcon, SunIcon,
} from '@chakra-ui/icons';
import {
  Box, Flex, Heading, HStack, IconButton, Menu, MenuButton,
  MenuDivider, MenuItem, MenuList, Portal, Spacer, Tag, useColorMode,
} from '@chakra-ui/react';
import React from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';

function Header() {
  const { colorMode, toggleColorMode } = useColorMode();

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
          <IconButton icon={<IoPlay />} variant="outline" size="md" colorScheme="green" />
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
