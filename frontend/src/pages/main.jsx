/* eslint-disable import/extensions */
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Button, HStack, VStack,
} from '@chakra-ui/react';
import { Split } from '@geoffcox/react-splitter';
import { useWindowSize } from '@react-hook/window-size';
import { ipcRenderer } from 'electron';
import React, {
  useRef, useState,
} from 'react';
import {
  ReactFlowProvider,
} from 'react-flow-renderer';
import useFetch from 'use-http';
import Header from '../components/Header.jsx';
import NodeSelector from '../components/NodeSelectorPanel.jsx';
import ReactFlowBox from '../components/ReactFlowBox.jsx';
import { createNodeTypes } from '../helpers/createNodeTypes.jsx';
import { GlobalProvider } from '../helpers/GlobalNodeState.jsx';

const { app } = require('electron');

function Main() {
  const [nodeTypes, setNodeTypes] = useState({});
  // const { colorMode, toggleColorMode } = useColorMode();
  const [width, height] = useWindowSize();

  const reactFlowWrapper = useRef(null);

  // Queries
  const [backendReady, setBackendReady] = useState(false);

  const options = {};
  const { loading, error, data = [] } = useFetch('http://localhost:8000/nodes', options, []);

  if (data && !loading && !error && !backendReady) {
    setBackendReady(true);
    ipcRenderer.send('backend-ready');
    setNodeTypes(createNodeTypes(data));
  }

  if (loading) {
    return <span>Loading...</span>;
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
    <GlobalProvider>
      <VStack w={width - 2} h={height - 2} p={2} overflow="hidden">
        <Header />
        <ReactFlowProvider>
          <HStack
            as={Split}
            initialPrimarySize="28%"
            minPrimarySize="250px"
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
              className="reactflow-wrapper"
              wrapperRef={reactFlowWrapper}
            />
          </HStack>
        </ReactFlowProvider>
      </VStack>
    </GlobalProvider>

  );
}

export default Main;
