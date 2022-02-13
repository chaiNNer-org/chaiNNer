/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { SearchIcon } from '@chakra-ui/icons';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, Center, Divider, Heading,
  HStack, Input, InputGroup, InputLeftElement, Tab, TabList, TabPanel,
  TabPanels, Tabs, Text, Tooltip, useColorModeValue, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import React, { memo, useEffect, useState } from 'react';
import { createRepresentativeNode } from '../helpers/createNodeTypes.jsx';
import { IconFactory } from './CustomIcons.jsx';
import DependencyManager from './DependencyManager.jsx';

const onDragStart = (event, nodeCategory, node) => {
  event.dataTransfer.setData('application/reactflow/type', node.name);
  event.dataTransfer.setData('application/reactflow/inputs', JSON.stringify(node.inputs));
  event.dataTransfer.setData('application/reactflow/outputs', JSON.stringify(node.outputs));
  event.dataTransfer.setData('application/reactflow/category', nodeCategory);
  event.dataTransfer.setData('application/reactflow/icon', node.icon);
  event.dataTransfer.setData('application/reactflow/offsetX', event.nativeEvent.offsetX);
  event.dataTransfer.setData('application/reactflow/offsetY', event.nativeEvent.offsetY);
  // eslint-disable-next-line no-param-reassign
  event.dataTransfer.effectAllowed = 'move';
};

// eslint-disable-next-line react/prop-types
const NodeSelector = ({ data, height }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const handleChange = (event) => setSearchQuery(event.target.value);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [namespaces, setNamespaces] = useState([]);

  useEffect(() => {
    const set = {};
    data?.forEach(({ category, nodes }) => {
      nodes
        .sort((a, b) => a.name.toUpperCase().localeCompare(b.name.toUpperCase()))
        .forEach((node) => {
          const namespace = node.name.split('::')[0];
          if (!set[category]) {
            set[category] = [];
          }
          if (!set[category].includes(namespace)) {
            set[category].push(namespace);
          }
        });
    });
    setNamespaces(set);
  }, [data]);

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
          <Tab isDisabled>Presets</Tab>
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
              overflowY="scroll"
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
                      {namespaces[category] && namespaces[category]
                      // eslint-disable-next-line max-len
                      // This is super terrible but I have no better way of filtering for these at the moment
                      // I could probably cache this in the namespace object but w/e
                        .filter(
                          (namespace) => `${category} ${nodes.filter((e) => e.name.includes(namespace)).map((e) => e.name).join(' ')}`.toLowerCase().includes(searchQuery.toLowerCase()),
                        )
                        .map((namespace) => (
                          <Box key={namespace}>
                            <Center w="full">
                              <HStack w="full">
                                <Divider orientation="horizontal" />
                                <Text fontSize="sm" color="#71809699" casing="uppercase">{namespace}</Text>
                                <Divider orientation="horizontal" />
                              </HStack>
                            </Center>
                            <Wrap>
                              {nodes
                                .filter(
                                  (e) => `${category} ${e.name}`.toLowerCase().includes(searchQuery.toLowerCase()),
                                )
                                .filter(
                                  (e) => e.name.toUpperCase().includes(namespace.toUpperCase()),
                                )
                                .sort(
                                  (a, b) => a.name.toUpperCase()
                                    .localeCompare(b.name.toUpperCase()),
                                )
                                .map((node) => (
                                  <WrapItem key={node.name} p={2}>
                                    <Tooltip label={node.description} hasArrow closeOnMouseDown>
                                      <Center
                                        boxSizing="border-box"
                                        onDragStart={(event) => onDragStart(event, category, node)}
                                        draggable
                                        display="block"
                                      >
                                        {createRepresentativeNode(category, node)}
                                      </Center>
                                    </Tooltip>
                                  </WrapItem>
                                ))}
                            </Wrap>
                          </Box>
                        ))}

                    </AccordionPanel>
                  </AccordionItem>
                ))}
                <AccordionItem>
                  <Center p={10} textOverflow="ellipsis">
                    <Box
                      onClick={onOpen}
                      cursor="pointer"
                      sx={{
                        cursor: 'pointer !important',
                        transition: '0.15s ease-in-out',
                      }}
                      bg={useColorModeValue('gray.200', 'gray.700')}
                      p={2}
                      pl={4}
                      pr={4}
                      borderRadius={10}
                      _hover={{
                        backgroundColor: 'gray.600',
                      }}
                    >
                      <Text
                        fontWeight="bold"
                        cursor="pointer"
                        sx={{
                          cursor: 'pointer !important',
                        }}
                        textAlign="center"
                      >
                        Missing nodes? Check the dependency manager!
                      </Text>
                    </Box>
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
};

export default memo(NodeSelector);
