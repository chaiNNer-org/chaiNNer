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

export const GlobalProvider = ({ children }) => {
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
      const inputData = nodeData[key];
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

    // console.log(JSON.stringify(result));

    return result;
  }

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
      animated: false,
      style: { strokeWidth: 2 },
    };
    setEdges([
      ...(edges.filter((edge) => edge.targetHandle !== targetHandle)),
      newEdge,
    ]);
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
    const [sourceHandleIndex] = sourceHandle.split('-').slice(-1);
    const [targetHandleIndex] = targetHandle.split('-').slice(-1);

    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);

    const sourceOutput = sourceNode.data.outputs[sourceHandleIndex];
    const targetInput = targetNode.data.inputs[targetHandleIndex];

    return sourceOutput.type === targetInput.type;
  }

  function useInputData(id, index) {
    const nodeDataById = nodeData[id] ?? {};
    const inputData = nodeDataById[index];
    const setInputData = (data) => {
      setNodeData({
        ...nodeData,
        [id]: {
          ...nodeDataById,
          [index]: data,
        },
      });
    };
    return [inputData, setInputData];
  }

  function useAnimateEdges() {
    const animateEdges = () => {
      setEdges(edges.map((edge) => ({
        ...edge,
        animated: true,
      })));
    };

    const unAnimateEdges = () => {
      setEdges(edges.map((edge) => ({
        ...edge,
        animated: false,
      })));
    };

    return [animateEdges, unAnimateEdges];
  }

  return (
    <GlobalContext.Provider value={{
      elements: [...nodes, ...edges],
      nodeData,
      createNode,
      createConnection,
      convertToUsableFormat,
      removeElements,
      reactFlowInstance,
      setReactFlowInstance,
      updateRfi,
      isValidConnection,
      useInputData,
      useAnimateEdges,
    }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
