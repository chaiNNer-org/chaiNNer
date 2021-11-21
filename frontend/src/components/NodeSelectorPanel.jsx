/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { SearchIcon } from '@chakra-ui/icons';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, Center, Heading, HStack, Input, InputGroup, InputLeftElement, Tab, TabList, TabPanel,
  TabPanels, Tabs, Tooltip, useColorModeValue, Wrap, WrapItem,
} from '@chakra-ui/react';
import React, { memo, useState } from 'react';
import { createRepresentativeNode } from '../helpers/createNodeTypes.jsx';
import { IconFactory } from './CustomIcons.jsx';

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
              h={height - 120}
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
                            <WrapItem key={node.name} p={4}>
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
                                {/* <Center
                                  w="180px"
                                  h="auto"
                                  borderWidth="1px"
                                  borderRadius="lg"
                                  p={4}
                                  onDragStart={(event) => onDragStart(event, node.name)}
                                  draggable
                                >
                                  <VStack>
                                    <Heading as="u" size="sm" casing="uppercase">{node.name.toUpperCase()}</Heading>
                                    <Text as="u" fontSize="xs">inputs</Text>
                                    {node.inputs.map((input) => (
                                      <Text key={input.label}>{input.label}</Text>
                                    ))}
                                    <Text as="u" fontSize="xs">outputs</Text>
                                    {node.outputs.map((output) => (
                                      <Text key={output.label}>{output.label}</Text>
                                    ))}
                                  </VStack>
                                </Center> */}
                              </Tooltip>
                            </WrapItem>
                          ))}
                      </Wrap>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

export default memo(NodeSelector);
