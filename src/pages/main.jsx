/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader,
  AlertDialogOverlay, Box, Button, Center, HStack, Text, useColorModeValue, VStack,
} from '@chakra-ui/react';
import { Split } from '@geoffcox/react-splitter';
import { useWindowSize } from '@react-hook/window-size';
import { app, ipcRenderer } from 'electron';
import log from 'electron-log';
import React, {
  memo, useEffect, useRef, useState,
} from 'react';
import { ReactFlowProvider } from 'react-flow-renderer';
import useFetch from 'use-http';
import ChaiNNerLogo from '../components/chaiNNerLogo.jsx';
import Header from '../components/Header.jsx';
import IteratorHelperNode from '../components/node/IteratorHelperNode.jsx';
import IteratorNode from '../components/node/IteratorNode.jsx';
import Node from '../components/node/Node.jsx';
import NodeSelector from '../components/NodeSelectorPanel.jsx';
import ReactFlowBox from '../components/ReactFlowBox.jsx';
import CustomEdge from '../helpers/CustomEdge.jsx';
import { GlobalProvider } from '../helpers/GlobalNodeState.jsx';

const Main = ({ port }) => {
  const [availableNodes, setAvailableNodes] = useState(null);
  const [nodeTypes, setNodeTypes] = useState(null);
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
  } = useFetch(`http://localhost:${port}/nodes`, options, [port]);

  const bgColor = useColorModeValue('gray.200', '#151a24');

  useEffect(() => {
    if (response.ok && data && !loading && !error && !backendReady) {
      setNodeTypes({
        regularNode: Node,
        iterator: IteratorNode,
        iteratorHelper: IteratorHelperNode,
      });
      const availableNodeMap = {};
      data.forEach(({ category, nodes }) => {
        availableNodeMap[category] = {};
        nodes.forEach((node) => {
          availableNodeMap[category][node.name] = node;
        });
      });
      setAvailableNodes(availableNodeMap);
    }
  }, [response, data, loading, error, backendReady]);

  useEffect(() => {
    (async () => {
      if (nodeTypes && !backendReady) {
        setBackendReady(true);
        try {
          await ipcRenderer.invoke('backend-ready');
        } catch (err) {
          log.error(err);
        }
      }
    })();
  }, [nodeTypes]);

  const loadingLogo = (<ChaiNNerLogo size={256} percent={0} />);

  if (!nodeTypes) {
    return (
      <Box w="100vw" h="100vh">
        <Center w="full" h="full">
          <VStack>
            {loadingLogo}
            <Text>Loading...</Text>
          </VStack>
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
      <GlobalProvider
        nodeTypes={nodeTypes}
        availableNodes={availableNodes}
        reactFlowWrapper={reactFlowWrapper}
      >
        <VStack p={2} overflow="hidden" bg={bgColor}>
          <Header port={port} />
          <HStack
            as={Split}
            initialPrimarySize="380px"
            minPrimarySize="290px"
            minSecondarySize="75%"
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

export default memo(Main);
