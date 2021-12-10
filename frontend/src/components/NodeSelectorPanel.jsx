/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { SearchIcon } from '@chakra-ui/icons';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, Button, Center, Heading, HStack, Input, InputGroup, InputLeftElement, Tab, TabList, TabPanel,
  TabPanels, Tabs, Tooltip, useColorModeValue, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import React, { memo, useState } from 'react';
import { createRepresentativeNode } from '../helpers/createNodeTypes.jsx';
import { IconFactory } from './CustomIcons.jsx';
import DependencyManager from './DependencyManager.jsx';

const onDragStart = (event, nodeCategory, node) => {
  event.dataTransfer.setData('application/reactflow/type', node.name);
  event.dataTransfer.setData('application/reactflow/inputs', JSON.stringify(node.inputs));
  event.dataTransfer.setData('application/reactflow/outputs', JSON.stringify(node.outputs));
  event.dataTransfer.setData('application/reactflow/category', nodeCategory);
  event.dataTransfer.setData('application/reactflow/offsetX', event.nativeEvent.offsetX);
  event.dataTransfer.setData('application/reactflow/offsetY', event.nativeEvent.offsetY);
  // eslint-disable-next-line no-param-reassign
  event.dataTransfer.effectAllowed = 'move';
};

// eslint-disable-next-line react/prop-types
function NodeSelector({ data, height }) {
  const [searchQuery, setSearchQuery] = useState('');
  const handleChange = (event) => setSearchQuery(event.target.value);
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box
      w="auto"
      h="100%"
      borderWidth="1px"
      borderRadius="lg"
    >
      <Tabs
        w="100%"
        h="100%"
        isFitted
      >
        <TabList>
          <Tab>Nodes</Tab>
          <Tab>Presets</Tab>
        </TabList>
        <TabPanels>
          <TabPanel m={0} p={0}>
            <InputGroup
              borderRadius={0}
            >
              <InputLeftElement
                pointerEvents="none"
              >
                <SearchIcon
                  color="gray.300"
                />
              </InputLeftElement>
              <Input
                variant="filled"
                type="text"
                placeholder="Search..."
                onChange={handleChange}
                borderRadius={0}
              />
            </InputGroup>
            <Box
              h={height - 165}
              overflowY="auto"
              sx={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0)',
                },
                '&::-webkit-scrollbar-track': {
                  borderRadius: '8px',
                  width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                  borderRadius: '8px',
                  backgroundColor: useColorModeValue('gray.300', 'gray.700'),
                },
              }}
            >

              <Accordion allowMultiple defaultIndex={data.map((item, index) => index)}>
                {data.map(({ category, nodes }) => (
                  <AccordionItem key={category}>
                    <AccordionButton>
                      <HStack flex="1" textAlign="left">
                        {IconFactory(category)}
                        <Heading size="5xl">{category}</Heading>
                      </HStack>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel>
                      <Wrap>
                        {nodes
                          .filter((e) => `${category} ${e.name}`.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((node) => (
                            <WrapItem key={node.name} p={2}>
                              <Tooltip label={node.description} hasArrow closeOnMouseDown>
                                <Center
                                  // w="180px"
                                  // h="auto"
                                  // maxW="180px"
                                  // minW="180px"
                                  boxSizing="border-box"
                                  onDragStart={(event) => onDragStart(event, category, node)}
                                  draggable
                                  // height="180px"
                                  // width="auto"
                                  display="block"
                                >
                                  {createRepresentativeNode(category, node)}
                                </Center>
                              </Tooltip>
                            </WrapItem>
                          ))}
                      </Wrap>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
                <AccordionItem>
                  <Center p={10}>
                    <Button onClick={onOpen}>Missing nodes? Check the dependency manager!</Button>
                  </Center>
                  {/* TODO: Replace this with a single instance of the
                   dep manager that shares a global open/close state */}
                  <DependencyManager
                    isOpen={isOpen}
                    onOpen={onOpen}
                    onClose={onClose}
                  />
                </AccordionItem>
              </Accordion>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

export default memo(NodeSelector);
