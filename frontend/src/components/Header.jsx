/* eslint-disable import/extensions */
import {
  DownloadIcon, HamburgerIcon, LinkIcon, MoonIcon, SunIcon,
} from '@chakra-ui/icons';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, Button, Flex, Heading, HStack, IconButton, Menu, MenuButton, MenuDivider, MenuItem,
  MenuList, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Portal, Spacer, Tag, Text, Textarea, useColorMode, useDisclosure, VStack,
} from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, { useContext, useEffect, useState } from 'react';
import { IoPause, IoPlay, IoStop } from 'react-icons/io5';
import useFetch from 'use-http';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';

const { spawn } = require('child_process');

function Header() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { convertToUsableFormat, useAnimateEdges } = useContext(GlobalContext);
  const [animateEdges, unAnimateEdges] = useAnimateEdges();
  const { post } = useFetch(`http://localhost:${ipcRenderer.sendSync('get-port')}/run`, {
    cachePolicy: 'no-cache',
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [deps, setDeps] = useState({});

  const [shellOutput, setShellOutput] = useState('');

  async function run() {
    animateEdges();
    const data = convertToUsableFormat();
    const response = await post(data);
    console.log(response);
    unAnimateEdges();
  }

  useEffect(() => {
    const pythonVersion = ipcRenderer.sendSync('get-python');
    setDeps({
      ...deps,
      pythonVersion,
    });
  }, []);

  const availableDeps = [{
    name: 'OpenCV',
    installCommand: 'pip install opencv-python',
  }];

  const runCommand = (installCommand) => {
    const command = spawn('pip', ['install', 'opencv-python']);
    command.stdout.on('data', (data) => {
      setShellOutput(data);
    });

    command.stderr.on('data', (data) => {
      setShellOutput(data);
    });

    command.on('error', (error) => {
      console.log(`error: ${error.message}`);
    });

    command.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
    });
  };

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

      <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside" size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Dependency Manager</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack w="full">
              <Text>
                {`Current Python version: ${deps.pythonVersion}`}
              </Text>
              <Accordion w="full">
                {availableDeps.map((dep) => (
                  <AccordionItem key={dep.name}>
                    <h2>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          {dep.name}
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      <VStack w="full">
                        <Flex align="center" w="full">
                          <Text>{`Installed version: ${dep.version ?? 'None'}`}</Text>
                          <Spacer />
                          <Button onClick={() => {
                            runCommand(dep.installCommand);
                          }}
                          >
                            Install

                          </Button>
                        </Flex>

                        <Textarea disabled placeholder="console output here" w="full" value={shellOutput} />
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
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
    </>
  );
}

export default Header;
