/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, Center, Heading, HStack, Tab, TabList, TabPanel, TabPanels, Tabs,
  Text, Tooltip, VStack, Wrap, WrapItem,
} from '@chakra-ui/react';
import React from 'react';
import { IconFactory } from './CustomIcons.jsx';

const onDragStart = (event, nodeType) => {
  event.dataTransfer.setData('application/reactflow', nodeType);
  event.dataTransfer.effectAllowed = 'move';
};

// eslint-disable-next-line react/prop-types
function NodeSelector({ data, height }) {
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
            <Box
              h={height - 120}
              overflowY="scroll"
              sx={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                },
                '&::-webkit-scrollbar-track': {
                  borderRadius: '8px',
                  width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
                        {nodes.map((node) => (
                          <WrapItem key={node.name} p={4}>
                            <Tooltip label={node.description} hasArrow closeOnMouseDown>
                              <Center
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
                              </Center>
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

export default NodeSelector;
