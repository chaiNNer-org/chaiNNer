import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel,
  Box, HStack, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useColorMode, VStack,
} from '@chakra-ui/react';
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
  const { colorMode, toggleColorMode } = useColorMode();

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
    <VStack w="100vw" h="100vh" p={2}>
      <Header />
      <HStack w="100%" h="100%">
        {/* <Button size="sm" colorScheme="blue" onClick={toggleColorMode}>
          Toggle Mode
        </Button> */}
        <Box w="500px" h="100%" borderWidth="1px" borderRadius="lg">
          <Tabs w="500px" h="100%" isFitted variant="enclosed">
            <TabList>
              <Tab>Nodes</Tab>
              <Tab>Presets</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <Box h="100%">
                  <Accordion allowMultiple defaultIndex={data.map((item, index) => index)}>
                    {data.map(({ category, nodes }) => (
                      <AccordionItem key={category}>
                        <AccordionButton>
                          <Box flex="1" textAlign="left">
                            <Text>{category}</Text>
                          </Box>
                          <AccordionIcon />
                        </AccordionButton>
                        <AccordionPanel pb={4}>
                          <ul>
                            {nodes.map((node) => (
                              <Text key={node.name} color="white">
                                <li>{node.name}</li>
                              </Text>
                            ))}
                          </ul>
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
          <ReactFlow elements={elements}>
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
