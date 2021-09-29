import {
  HamburgerIcon, LinkIcon, MoonIcon, SunIcon,
} from '@chakra-ui/icons';
import {
  Box, Flex, Heading, HStack, IconButton, Menu,
  MenuButton, MenuDivider, MenuItem, MenuList, Portal, Spacer, Tag, useColorMode,
} from '@chakra-ui/react';
import React from 'react';

function Header() {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <Box w="100%" h="48px" borderWidth="1px" borderRadius="lg">
      <Flex align="center" h="100%" p={2}>
        <HStack>
          <LinkIcon />
          <Heading size="md">
            chaiNNer
          </Heading>
          <Tag>v0.0.1</Tag>
        </HStack>
        <Spacer />
        <Menu isLazy style={{ zIndex: 9999 }}>
          <MenuButton as={IconButton} icon={<HamburgerIcon />} variant="outline" size="sm">
            Settings
          </MenuButton>
          <Portal style={{ zIndex: 9999 }}>
            <MenuList style={{ zIndex: 9999 }}>
              <MenuItem icon={colorMode === 'dark' ? <SunIcon /> : <MoonIcon />} onClick={() => toggleColorMode()} style={{ zIndex: 9999 }}>
                Toggle Theme
              </MenuItem>
              <MenuDivider />
              <MenuItem onClick={() => alert('This would quit the application')} style={{ zIndex: 9999 }}>Quit Application</MenuItem>
            </MenuList>
          </Portal>
        </Menu>

      </Flex>

    </Box>
  );
}

export default Header;
