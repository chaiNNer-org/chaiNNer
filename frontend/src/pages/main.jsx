/* eslint-disable import/extensions */
import { HStack, VStack } from '@chakra-ui/react';
import { Split } from '@geoffcox/react-splitter';
import { useWindowSize } from '@react-hook/window-size';
import { ipcRenderer } from 'electron';
import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import { useQuery } from 'react-query';
import {
  ReactFlowProvider,
  addEdge,
  removeElements,
} from 'react-flow-renderer';
import { fetchNodes } from '../api/nodes';
import Header from '../components/Header.jsx';
import NodeSelector from '../components/NodeSelectorPanel.jsx';
import ReactFlowBox from '../components/ReactFlowBox.jsx';
import { createNodeTypes } from '../helpers/createNodeTypes.jsx';

// const elements = [
//   {
//     id: '1',
//     type: 'input', // input node
//     data: { label: 'Input Node' },
//     position: { x: 250, y: 25 },
//   },
//   // default node
//   {
//     id: '2',
//     // you can also pass a React component as a label
//     data: { label: <div>Default Node</div> },
//     position: { x: 100, y: 125 },
//   },
//   {
//     id: '3',
//     type: 'output', // output node
//     data: { label: 'Output Node' },
//     position: { x: 250, y: 250 },
//   },
//   // animated edge
//   {
//     id: 'e1-2', source: '1', target: '2', animated: true,
//   },
//   { id: 'e2-3', source: '2', target: '3' },
// ];

let id = 0;
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
  const {
    isLoading, isError, data, error,
  } = useQuery('nodes', fetchNodes);
  if (data && !isLoading && !isError && !backendReady) {
    setBackendReady(true);
    ipcRenderer.send('backend-ready');
  }

  useEffect(() => {
    setNodeTypes(createNodeTypes(data));
    console.log(nodeTypes);
  }, [data]);

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
      <ReactFlowProvider>
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
