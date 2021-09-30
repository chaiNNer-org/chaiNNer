import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, Center, Heading, HStack, Tab, TabList, TabPanel, TabPanels, Tabs,
  Text, VStack, Wrap, WrapItem,
} from '@chakra-ui/react';
import { Split } from '@geoffcox/react-splitter';
import { useWindowSize } from '@react-hook/window-size';
import { ipcRenderer } from 'electron';
import React, { useState } from 'react';
import ReactFlow, { Background, Controls } from 'react-flow-renderer';
import { useQuery } from 'react-query';
import { fetchNodes } from '../api/nodes';
// eslint-disable-next-line import/extensions
import Header from '../components/Header.jsx';

const elements = [
  {
    id: '1',
    type: 'input', // input node
    data: { label: 'Input Node' },
    position: { x: 250, y: 25 },
  },
  // default node
  {
    id: '2',
    // you can also pass a React component as a label
    data: { label: <div>Default Node</div> },
    position: { x: 100, y: 125 },
  },
  {
    id: '3',
    type: 'output', // output node
    data: { label: 'Output Node' },
    position: { x: 250, y: 250 },
  },
  // animated edge
  {
    id: 'e1-2', source: '1', target: '2', animated: true,
  },
  { id: 'e2-3', source: '2', target: '3' },
];

function Main() {
  // const { colorMode, toggleColorMode } = useColorMode();
  const [width, height] = useWindowSize();

  // Queries
  const [backendReady, setBackendReady] = useState(false);
  const {
    isLoading, isError, data, error,
  } = useQuery('nodes', fetchNodes);
  if (data && !isLoading && !isError && !backendReady) {
    setBackendReady(true);
    ipcRenderer.send('backend-ready');
  }

  if (isLoading) {
    return <span>Loading...</span>;
  }

  if (isError) {
    return (
      <span>
        Error:
        {error.message}
      </span>
    );
  }

  return (
    <VStack w={width - 2} h={height - 2} p={2} overflow="hidden">
      <Header />
      <HStack
        as={Split}
        initialPrimarySize="25%"
        minPrimarySize="250px"
        minSecondarySize="50%"
        splitterSize="10px"
        defaultSplitterColors={{
          color: '#71809633',
          hover: '#71809666',
          drag: '#718096EE',
        }}
      >
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
            variant="enclosed"
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
                          <Box flex="1" textAlign="left">
                            <Heading size="5xl">{category}</Heading>
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel>
                          <Wrap>
                            {nodes.map((node) => (
                              <WrapItem key={node.name} p={4}>
                                <Center w="180px" h="auto" borderWidth="1px" borderRadius="lg" p={4}>
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

        <Box w="100%" h="100%" borderWidth="1px" borderRadius="lg">
          <ReactFlow elements={elements} style={{ zIndex: 0 }}>
            <Background
              variant="dots"
              gap={16}
              size={0.5}
            />
            <Controls />
          </ReactFlow>
        </Box>
      </HStack>
    </VStack>

  );
}

export default Main;
