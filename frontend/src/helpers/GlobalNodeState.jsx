/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import React, {
  createContext, useCallback, useEffect, useState,
} from 'react';
import {
  isEdge, isNode, removeElements as rfRemoveElements, useZoomPanHelper,
} from 'react-flow-renderer';
import { v4 as uuidv4 } from 'uuid';
import useSessionStorage from './useSessionStorage.js';

export const GlobalContext = createContext({});

function createUniqueId() {
  return uuidv4();
}

export const GlobalProvider = ({ nodeTypes, children }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [nodeData, setNodeData] = useSessionStorage('nodeData', {});
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const { transform } = useZoomPanHelper();

  function convertToUsableFormat() {
    const result = {};

    // Set up each node in the result
    nodes.forEach((element) => {
      const { type, id, data } = element;
      const { category } = data;
      // Node
      result[id] = {
        category,
        node: type,
        id,
        inputs: {},
        outputs: {},
      };
    });

    // Apply input data to inputs when applicable
    Object.keys(nodeData).forEach((key) => {
      const { inputData } = nodeData[key];
      if (inputData) {
        Object.keys(inputData).forEach((index) => {
          result[key].inputs[index] = inputData[index];
        });
      }
    });

    // Apply inputs and outputs from connections
    // Note: As-is, this will overwrite inputted data from above
    edges.forEach((element) => {
      const {
        // eslint-disable-next-line no-unused-vars
        id, sourceHandle, targetHandle, source, target, type,
      } = element;
      // Connection
      result[source].outputs[sourceHandle.split('-').slice(-1)] = { id: target };
      result[target].inputs[targetHandle.split('-').slice(-1)] = { id: source };
    });

    // Convert inputs and outputs to arrays
    Object.keys(result).forEach((id) => {
      result[id].inputs = Object.values(result[id].inputs);
      result[id].outputs = Object.values(result[id].outputs);
    });

    console.log(JSON.stringify(result));

    return result;
  }

  // function setElements(elements) {
  //   dispatch({
  //     type: 'SET_ELEMENTS',
  //     payload: elements,
  //   });
  // }

  function removeElements(elements) {
    const nodeDataCopy = { ...nodeData };
    const nodesToRemove = elements.filter((element) => element.data && !element.source);
    const edgesToRemove = elements.filter((element) => !element.data && element.source);
    nodesToRemove.forEach((node) => {
      delete nodeDataCopy[node.id];
    });
    setNodes(rfRemoveElements(nodesToRemove, nodes));
    setEdges(rfRemoveElements(edgesToRemove, edges));
    setNodeData(nodeDataCopy);
  }

  function createNode({
    type, position, data,
  }) {
    const id = createUniqueId();
    const newNode = {
      type, id, position, data: { ...data, id },
    };
    setNodes([
      ...nodes,
      newNode,
    ]);
  }

  function createConnection({
    source, sourceHandle, target, targetHandle, type,
  }) {
    const id = createUniqueId();
    const newEdge = {
      id,
      sourceHandle,
      targetHandle,
      source,
      target,
      type,
      animated: true,
      style: { strokeWidth: 2 },
    };
    setEdges([
      ...(edges.filter((edge) => edge.targetHandle !== targetHandle)),
      newEdge,
    ]);
  }

  // function removeItemFromList(item) {
  //   dispatch({
  //     type: 'REMOVE_ITEM',
  //     payload: item,
  //   });
  // }

  function useNodeData(id) {
    const individualNodeData = nodeData[id];
    const setNodeDataById = (data) => {
      setNodeData({
        ...nodeData,
        [id]: {
          ...data,
        },
      });
    };
    return [individualNodeData, setNodeDataById];
  }

  useEffect(() => {
    const flow = JSON.parse(sessionStorage.getItem('rfi'));
    if (flow) {
      const [x = 0, y = 0] = flow.position;
      setNodes(flow.elements.filter((element) => isNode(element)) || []);
      setEdges(flow.elements.filter((element) => isEdge(element)) || []);
      transform({ x, y, zoom: flow.zoom || 0 });
    }
  }, []);

  useEffect(() => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      sessionStorage.setItem('rfi', JSON.stringify(flow));
    }
  }, [nodes, edges, reactFlowInstance]);

  const updateRfi = useCallback(() => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      sessionStorage.setItem('rfi', JSON.stringify(flow));
    }
  }, [nodes, edges, reactFlowInstance, transform]);

  function isValidConnection({
    target, targetHandle, source, sourceHandle,
  }) {
    const sourceHandleIndex = sourceHandle.split('-').slice(-1);
    const targetHandleIndex = targetHandle.split('-').slice(-1);

    const { outputs: sourceOutputs } = nodes.find((node) => node.id === source);
    const { inputs: targetInputs } = nodes.find((node) => node.id === target);

    const sourceOutput = sourceOutputs[sourceHandleIndex];
    const targetOutput = targetInputs[targetHandleIndex];

    return sourceOutput.type === targetOutput.type;
  }

  return (
    <GlobalContext.Provider value={{
      elements: [...nodes, ...edges],
      nodeData,
      createNode,
      createConnection,
      // removeItemFromList,
      useNodeData,
      convertToUsableFormat,
      removeElements,
      reactFlowInstance,
      setReactFlowInstance,
      updateRfi,
      isValidConnection,
    }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
