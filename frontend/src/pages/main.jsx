/* eslint-disable import/extensions */
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, Center, HStack, Spinner, VStack,
} from '@chakra-ui/react';
import { Split } from '@geoffcox/react-splitter';
import { useWindowSize } from '@react-hook/window-size';
import { ipcRenderer } from 'electron';
import log from 'electron-log';
import React, { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from 'react-flow-renderer';
import useFetch from 'use-http';
import Header from '../components/Header.jsx';
import NodeSelector from '../components/NodeSelectorPanel.jsx';
import ReactFlowBox from '../components/ReactFlowBox.jsx';
import { createNodeTypes } from '../helpers/createNodeTypes.jsx';
import CustomEdge from '../helpers/CustomEdge.jsx.jsx';
import { GlobalProvider } from '../helpers/GlobalNodeState.jsx';

const { app } = require('electron');

const Main = () => {
  useEffect(() => {
    log.info('Main window mounted.');
  }, []);

  const [nodeTypes, setNodeTypes] = useState({});
  const edgeTypes = {
    main: CustomEdge,
  };
  // const { colorMode, toggleColorMode } = useColorMode();
  const [width, height] = useWindowSize();

  const reactFlowWrapper = useRef(null);

  // Queries
  const [backendReady, setBackendReady] = useState(false);

  const options = { cachePolicy: 'no-cache', retries: 10 };
  const {
    loading, error, data, response,
  } = useFetch(`http://localhost:${ipcRenderer.sendSync('get-port')}/nodes`, options, []);

  if (response.ok && data && !loading && !error && !backendReady) {
    setBackendReady(true);
    setNodeTypes(createNodeTypes(data));
    ipcRenderer.send('backend-ready');
  }

  if (loading && !backendReady) {
    return (
      <Box w={width} h={height}>
        <Center w="full" h="full">
          <Spinner />
        </Center>
      </Box>
    );
  }

  if (error) {
    return (
      <AlertDialog
        isOpen
        onClose={() => {
          window.close();
          app.quit();
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Critical Error
            </AlertDialogHeader>

            <AlertDialogBody>
              {error.message}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                colorScheme="red"
                onClick={() => {
                  window.close();
                  app.quit();
                }}
                ml={3}
              >
                Exit Application
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    );
  }

  return (
    <ReactFlowProvider>
      <GlobalProvider nodeTypes={nodeTypes}>
        <VStack w={width - 2} h={height - 2} p={2} overflow="hidden">
          <Header />
          <HStack
            as={Split}
            initialPrimarySize="565px"
            minPrimarySize="290px"
            minSecondarySize="50%"
            splitterSize="10px"
            defaultSplitterColors={{
              color: '#71809633',
              hover: '#71809666',
              drag: '#718096EE',
            }}
          >
            <NodeSelector data={data} height={height} />

            <ReactFlowBox
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              className="reactflow-wrapper"
              wrapperRef={reactFlowWrapper}
            />
          </HStack>
        </VStack>
      </GlobalProvider>
    </ReactFlowProvider>

  );
};

export default Main;
