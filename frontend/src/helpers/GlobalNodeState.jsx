/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { ipcRenderer } from 'electron';
import React, {
  createContext, useCallback, useEffect, useState,
} from 'react';
import {
  isEdge, isNode, removeElements as rfRemoveElements, useZoomPanHelper,
} from 'react-flow-renderer';
import { useHotkeys } from 'react-hotkeys-hook';
import { v4 as uuidv4 } from 'uuid';
// import useUndoHistory from './useMultipleUndoHistory.js';
// import usePrevious from './usePrevious.js';
import useSessionStorage from './useSessionStorage.js';

export const GlobalContext = createContext({});

const createUniqueId = () => uuidv4();

export const GlobalProvider = ({ children }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [nodeData, setNodeData] = useSessionStorage('nodeData', {});
  const [nodeLocks, setNodeLocks] = useSessionStorage('nodeLocks', {});
  // At this point i dont even understand how my code works enough to know why i need these both....
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [reactFlowInstanceRfi, setRfi] = useSessionStorage('rfi', null);
  const [savePath, setSavePath] = useState();

  // const prevState = usePrevious({ reactFlowInstanceRfi, nodeData, nodeLocks });
  // // eslint-disable-next-line no-unused-vars
  // const [undo, redo, push, previous, current, next] = useUndoHistory(10);

  const { transform } = useZoomPanHelper();

  const dumpStateToJSON = () => {
    const fullState = {
      nodeData,
      nodeLocks,
      rfi: reactFlowInstanceRfi,
    };
    const output = JSON.stringify(fullState);
    return output;
  };

  const setStateFromJSON = (json) => {
    const {
      nodeData: nd,
      nodeLocks: nl,
      rfi,
    } = json;

    const [x = 0, y = 0] = rfi.position;
    setNodes(rfi.elements.filter((element) => isNode(element)) || []);
    setEdges(rfi.elements.filter((element) => isEdge(element)) || []);
    transform({ x, y, zoom: rfi.zoom || 0 });

    setNodeData(nd);
    setNodeLocks(nl);
  };

  // const setRfiState = (rfi) => {
  //   const [x = 0, y = 0] = rfi.position;
  //   setNodes(rfi.elements.filter((element) => isNode(element)) || []);
  //   setEdges(rfi.elements.filter((element) => isEdge(element)) || []);
  //   transform({ x, y, zoom: rfi.zoom || 0 });
  // };

  // useEffect(() => {
  //   if (current) {
  //     const { type, data } = JSON.parse(current);
  //     switch (type) {
  //       case 'rfi':
  //         setRfiState(data);
  //         break;
  //       case 'nodeData':
  //         setNodeData(data);
  //         break;
  //       // case 'nodeLocks':
  //       //   setNodeLocks(data);
  //       //   break;
  //       default:
  //     }
  //   }
  // }, [current]);

  // useEffect(() => {
  //   push({
  //     previous: JSON.stringify({ type: 'rfi', data: prevState?.reactFlowInstanceRfi }),
  //     current: JSON.stringify({ type: 'rfi', data: reactFlowInstanceRfi }),
  //   });
  // }, [reactFlowInstanceRfi]);

  // useEffect(() => {
  //   push({
  //     previous: JSON.stringify({ type: 'nodeData', data: prevState?.nodeData }),
  //     current: JSON.stringify({ type: 'nodeData', data: nodeData }),
  //   });
  // }, [nodeData]);

  // useEffect(() => {
  //   push({
  //     previous: JSON.stringify({ type: 'nodeLocks', data: prevState?.nodeLocks }),
  //     current: JSON.stringify({ type: 'nodeLocks', data: nodeLocks }),
  //   });
  // }, [nodeLocks]);

  const clearState = () => {
    setEdges([]);
    setNodes([]);
    setNodeData({});
    setNodeLocks({});
    setSavePath(undefined);
    // transform({ x: 0, y: 0, zoom: 0 });
  };

  // const performUndo = () => {
  //   try {
  //     const history = undo();
  //     if (history) {
  //       setStateFromJSON(JSON.parse(history));
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  // const performRedo = () => {
  //   try {
  //     const history = redo();
  //     if (history) {
  //       setStateFromJSON(JSON.parse(history));
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  const performSave = useCallback(async () => {
    const json = dumpStateToJSON();
    if (savePath) {
      ipcRenderer.invoke('file-save-json', json, savePath);
    } else {
      const savedAsPath = await ipcRenderer.invoke('file-save-as-json', json, savePath);
      setSavePath(savedAsPath);
    }
  }, [nodeData, nodeLocks, reactFlowInstanceRfi, nodes, edges, savePath]);

  useHotkeys('ctrl+s', performSave, {}, [nodeData, nodeLocks, reactFlowInstanceRfi, nodes, edges, savePath]);
  // useHotkeys('ctrl+z', undo, {}, [reactFlowInstanceRfi, nodeData, nodeLocks]);
  // useHotkeys('ctrl+r', redo, {}, [reactFlowInstanceRfi, nodeData, nodeLocks]);
  // useHotkeys('ctrl+shift+z', redo, {}, [nodeData, nodeLocks, reactFlowInstanceRfi, nodes, edges]);
  useHotkeys('ctrl+n', clearState, {}, []);

  // Register New File event handler
  useEffect(() => {
    ipcRenderer.on('file-new', () => {
      clearState();
    });
    return () => {
      ipcRenderer.removeAllListeners('file-new');
    };
  }, []);

  // Register Open File event handler
  useEffect(() => {
    ipcRenderer.on('file-open', (event, json, openedFilePath) => {
      setSavePath(openedFilePath);
      setStateFromJSON(json);
    });

    return () => {
      ipcRenderer.removeAllListeners('file-open');
    };
  }, [savePath]);

  // Register Save/Save-As event handlers
  useEffect(() => {
    ipcRenderer.on('file-save-as', async () => {
      const json = dumpStateToJSON();
      const savedAsPath = await ipcRenderer.invoke('file-save-as-json', json, savePath);
      setSavePath(savedAsPath);
    });

    ipcRenderer.on('file-save', () => {
      performSave();
    });

    return () => {
      ipcRenderer.removeAllListeners('file-save-as');
      ipcRenderer.removeAllListeners('file-save');
    };
  }, [nodeData, nodeLocks, reactFlowInstanceRfi, nodes, edges, savePath]);

  // Push state to undo history
  // useEffect(() => {
  //   push(dumpStateToJSON());
  // }, [nodeData, nodeLocks, reactFlowInstanceRfi, nodes, edges]);

  const convertToUsableFormat = () => {
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
  };

  const removeElements = (elements) => {
    const nodeDataCopy = { ...nodeData };
    const nodesToRemove = elements.filter((element) => isNode(element));
    const edgesToRemove = elements.filter((element) => isEdge(element));
    nodesToRemove.forEach((node) => {
      delete nodeDataCopy[node.id];
    });
    setEdges(rfRemoveElements(edgesToRemove, edges));
    setNodes(rfRemoveElements(nodesToRemove, nodes));
    setNodeData(nodeDataCopy);
  };

  const removeNodeById = (id) => {
    const nodeDataCopy = { ...nodeData };
    const nodeToRemove = nodes.find((node) => node.id === id);
    delete nodeDataCopy[id];
    const newElements = rfRemoveElements([nodeToRemove], [...nodes, ...edges]);
    setEdges(newElements.filter((element) => isEdge(element)));
    setNodes(newElements.filter((element) => isNode(element)));
    setNodeData(nodeDataCopy);
  };

  const createNode = ({
    type, position, data,
  }) => {
    const id = createUniqueId();
    const newNode = {
      type, id, position, data: { ...data, id },
    };
    setNodes([
      ...nodes,
      newNode,
    ]);
    return id;
  };

  const createConnection = ({
    source, sourceHandle, target, targetHandle, type,
  }) => {
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
  };

  useEffect(() => {
    const flow = JSON.parse(sessionStorage.getItem('rfi'));
    if (flow) {
      const [x = 0, y = 0] = flow.position;
      setNodes(flow.elements.filter((element) => isNode(element)) || []);
      setEdges(flow.elements.filter((element) => isEdge(element)) || []);
      transform({ x, y, zoom: flow.zoom || 0 });
    }
  }, []);

  // Updates the saved reactFlowInstance object
  useEffect(() => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      setRfi(flow);
    }
  }, [nodes, edges]);

  // Update rfi when drag and drop on drag end
  const updateRfi = () => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      setRfi(flow);
    }
  };

  const isValidConnection = ({
    target, targetHandle, source, sourceHandle,
  }) => {
    if (source === target) {
      return false;
    }
    const [sourceHandleIndex] = sourceHandle.split('-').slice(-1);
    const [targetHandleIndex] = targetHandle.split('-').slice(-1);

    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);

    const sourceOutput = sourceNode.data.outputs[sourceHandleIndex];
    const targetInput = targetNode.data.inputs[targetHandleIndex];

    return sourceOutput.type === targetInput.type;
  };

  const useInputData = (id, index) => {
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
  };

  const useAnimateEdges = () => {
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
  };

  // TODO: performance concern? runs twice when deleting node
  const useNodeLock = useCallback((id) => {
    // console.log('perf check (node lock)');
    const isLocked = nodeLocks[id] ?? false;
    const toggleLock = () => {
      const node = nodes.find((n) => n.id === id);
      node.draggable = isLocked;
      node.connectable = isLocked;
      setNodeLocks({
        ...nodeLocks,
        [id]: !isLocked,
      });
      setNodes([
        ...nodes.filter((n) => n.id !== id),
        node,
      ]);
    };
    return [isLocked, toggleLock];
  }, [nodeLocks, nodes]);

  const useNodeValidity = useCallback((id) => {
    // console.log('perf check (node validity)');
    // This should never happen, but I'd rather not have this function crash if it does
    const node = nodes.find((n) => n.id === id);
    if (!node) {
      return [false, 'Node not found.'];
    }
    // This should also never happen.
    const { inputs } = node.data;
    if (!inputs) {
      return [false, 'Node has no inputs.'];
    }
    const inputData = nodeData[id] ?? {};
    const filteredEdges = edges.filter((e) => e.target === id);
    // Check to make sure the node has all the data it should based on the schema.
    // Compares the schema against the connections and the entered data
    if (inputs.length !== Object.keys(inputData).length + filteredEdges.length) {
      // Grabs all the indexes of the inputs that the connections are targeting
      const edgeTargetIndexes = edges.map((edge) => edge.targetHandle.split('-').slice(-1)[0]);
      // Grab all inputs that do not have data or a connected edge
      const missingInputs = inputs.filter((input, i) => !Object.keys(inputData).includes(String(i))
        && !edgeTargetIndexes.includes(String(i)));
      return [false, `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`];
    }

    return [true];
  }, [nodeData, edges, nodes]);

  const duplicateNode = (id) => {
    const rfiNodes = reactFlowInstance.getElements();
    const node = rfiNodes.find((n) => n.id === id);
    const x = node.position.x + 200;
    const y = node.position.y + 200;
    const newId = createNode({
      type: node.type, position: { x, y }, data: node.data,
    });
    const nodeDataCopy = { ...nodeData };
    nodeDataCopy[newId] = { ...nodeData[id] };
    setNodeData(nodeDataCopy);
  };

  const clearNode = (id) => {
    const nodeDataCopy = { ...nodeData };
    delete nodeDataCopy[id];
    setNodeData(nodeDataCopy);
  };

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
      removeNodeById,
      useNodeLock,
      useNodeValidity,
      duplicateNode,
      clearNode,
    }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
