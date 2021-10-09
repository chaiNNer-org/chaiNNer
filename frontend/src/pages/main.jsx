/* eslint-disable import/extensions */
import {
  AlertDialog,
  AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Button, HStack, VStack,
} from '@chakra-ui/react';
import { Split } from '@geoffcox/react-splitter';
import { useWindowSize } from '@react-hook/window-size';
import { ipcRenderer } from 'electron';
import React, {
  useCallback, useRef, useState,
} from 'react';
import {
  addEdge, ReactFlowProvider, removeElements,
} from 'react-flow-renderer';
import useFetch from 'use-http';
import Header from '../components/Header.jsx';
import NodeSelector from '../components/NodeSelectorPanel.jsx';
import ReactFlowBox from '../components/ReactFlowBox.jsx';
import { createNodeTypes } from '../helpers/createNodeTypes.jsx';

const { app } = require('electron');

let id = 0;
// eslint-disable-next-line no-plusplus
const getId = () => `dndnode_${id++}`;

function Main() {
  const [nodeTypes, setNodeTypes] = useState({});
  // const { colorMode, toggleColorMode } = useColorMode();
  const [width, height] = useWindowSize();

  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [elements, setElements] = useState([]);
  const onConnect = useCallback(
    (params) => setElements((els) => addEdge({ ...params, animated: true, style: { stroke: '#fff' } }, els)),
    [],
  );
  const onElementsRemove = useCallback(
    (elementsToRemove) => setElements((els) => removeElements(elementsToRemove, els)),
    [],
  );

  const onLoad = useCallback(
    (rfi) => {
      if (!reactFlowInstance) {
        setReactFlowInstance(rfi);
        console.log('flow loaded:', rfi);
      }
    },
    [reactFlowInstance],
  );

  const onDragOver = (event) => {
    event.preventDefault();
    // eslint-disable-next-line no-param-reassign
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event) => {
    event.preventDefault();

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();

    const type = event.dataTransfer.getData('application/reactflow');

    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const newNode = {
      id: getId(),
      type,
      position,
      data: { label: `${type} node` },
    };

    setElements((es) => es.concat(newNode));
  };

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
            elements={elements}
            onConnect={onConnect}
            onElementsRemove={onElementsRemove}
            onLoad={onLoad}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            className="reactflow-wrapper"
            wrapperRef={reactFlowWrapper}
          />
        </HStack>
      </ReactFlowProvider>
    </VStack>

  );
}

export default Main;
