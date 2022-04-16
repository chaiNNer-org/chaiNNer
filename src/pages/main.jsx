import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader,
  AlertDialogOverlay, Box, Button, Center, HStack, Text, useColorModeValue, VStack,
} from '@chakra-ui/react';
import { Split } from '@geoffcox/react-splitter';
import { useWindowSize } from '@react-hook/window-size';
import { app, ipcRenderer } from 'electron';
import log from 'electron-log';
import {
  memo, useEffect, useRef, useState,
} from 'react';
import { ReactFlowProvider } from 'react-flow-renderer';
import useFetch from 'use-http';
import ChaiNNerLogo from '../components/chaiNNerLogo.jsx';
import CustomEdge from '../components/CustomEdge.jsx';
import Header from '../components/Header.jsx';
import IteratorHelperNode from '../components/node/IteratorHelperNode.jsx';
import IteratorNode from '../components/node/IteratorNode.jsx';
import Node from '../components/node/Node.jsx';
import NodeSelector from '../components/NodeSelectorPanel.jsx';
import ReactFlowBox from '../components/ReactFlowBox.jsx';
import { GlobalProvider } from '../helpers/contexts/GlobalNodeState.jsx';
import { SettingsProvider } from '../helpers/contexts/SettingsContext.jsx';

const Main = ({ port }) => {
  // console.log('🚀 ~ file: main.jsx ~ line 27 ~ Main ~ port', port);
  const [availableNodes, setAvailableNodes] = useState(null);
  const [nodeTypes, setNodeTypes] = useState(null);
  const edgeTypes = {
    main: CustomEdge,
  };
  // const { colorMode, toggleColorMode } = useColorMode();
  const [, height] = useWindowSize();

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

  const loadingLogo = (
    <ChaiNNerLogo
      percent={0}
      size={256}
    />
  );

  if (!nodeTypes) {
    return (
      <Box
        h="100vh"
        w="100vw"
      >
        <Center
          h="full"
          w="full"
        >
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
            <AlertDialogHeader
              fontSize="lg"
              fontWeight="bold"
            >
              Critical Error
            </AlertDialogHeader>

            <AlertDialogBody>
              {error.message}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                colorScheme="red"
                ml={3}
                onClick={() => {
                  window.close();
                  app.quit();
                }}
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
      <SettingsProvider port={port}>
        <GlobalProvider
          availableNodes={availableNodes}
          nodeTypes={nodeTypes}
          reactFlowWrapper={reactFlowWrapper}
        >
          <VStack
            bg={bgColor}
            overflow="hidden"
            p={2}
          >
            <Header port={port} />
            <HStack
              as={Split}
              defaultSplitterColors={{
                color: '#71809633',
                hover: '#71809666',
                drag: '#718096EE',
              }}
              initialPrimarySize="380px"
              minPrimarySize="290px"
              minSecondarySize="75%"
              splitterSize="10px"
            >
              <NodeSelector
                data={data}
                height={height}
              />

              <ReactFlowBox
                className="reactflow-wrapper"
                edgeTypes={edgeTypes}
                nodeTypes={nodeTypes}
                wrapperRef={reactFlowWrapper}
              />
            </HStack>
          </VStack>
        </GlobalProvider>
      </SettingsProvider>
    </ReactFlowProvider>

  );
};

export default memo(Main);
