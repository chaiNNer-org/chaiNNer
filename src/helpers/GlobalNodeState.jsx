/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { ipcRenderer } from 'electron';
import React, {
  createContext, useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  getOutgoers,
  isEdge, isNode, removeElements as rfRemoveElements, useZoomPanHelper,
} from 'react-flow-renderer';
import { useHotkeys } from 'react-hotkeys-hook';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorage from './hooks/useLocalStorage.js';
import useUndoHistory from './hooks/useMultipleUndoHistory.js';
import useSessionStorage from './hooks/useSessionStorage.js';

export const GlobalContext = createContext({});

const createUniqueId = () => uuidv4();

export const GlobalProvider = ({ children }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [reactFlowInstanceRfi, setRfi] = useSessionStorage('rfi', null);
  const [savePath, setSavePath] = useState();

  const [isCpu, setIsCpu] = useLocalStorage('is-cpu', false);
  const [isFp16, setIsFp16] = useLocalStorage('is-fp16', false);

  const [loadedFromCli, setLoadedFromCli] = useSessionStorage('loaded-from-cli', false);

  // cut/copy/paste
  // const [selectedElements, setSelectedElements] = useState([]);
  // const [copiedElements, setCopiedElements] = useState([]);

  // eslint-disable-next-line no-unused-vars
  const [undo, redo, push, current] = useUndoHistory(10);

  const { transform } = useZoomPanHelper();

  const dumpStateToJSON = async () => {
    const output = JSON.stringify({
      version: await ipcRenderer.invoke('get-app-version'),
      content: reactFlowInstanceRfi,
      timestamp: new Date(),
    });
    return output;
  };

  const setStateFromJSON = (savedData, loadPosition = false) => {
    if (savedData) {
      setNodes(savedData.elements.filter((element) => isNode(element)) || []);
      setEdges(savedData.elements.filter((element) => isEdge(element)) || []);
      if (loadPosition) {
        const [x = 0, y = 0] = savedData.position;
        transform({ x, y, zoom: savedData.zoom || 0 });
      }
    }
  };

  // const setRfiState = (rfi) => {
  //   const [x = 0, y = 0] = rfi.position;
  //   setNodes(rfi.elements.filter((element) => isNode(element)) || []);
  //   setEdges(rfi.elements.filter((element) => isEdge(element)) || []);
  //   transform({ x, y, zoom: rfi.zoom || 0 });
  // };

  // TODO: Potential performance issue. Gets called every time rfi state changes
  // Ideally, this would only change when an undo or redo has been performed
  // useEffect(() => {
  //   if (current) {
  //     const data = JSON.parse(current);
  //     setStateFromJSON(data, false);
  //   }
  // }, [current]);

  // useEffect(() => {
  //   push(dumpStateToJSON());
  // }, [reactFlowInstanceRfi]);

  const clearState = () => {
    setEdges([]);
    setNodes([]);
    setSavePath(undefined);
    transform({ x: 0, y: 0, zoom: 0 });
  };

  const performSave = useCallback(async () => {
    const json = await dumpStateToJSON();
    if (savePath) {
      ipcRenderer.invoke('file-save-json', json, savePath);
    } else {
      const savedAsPath = await ipcRenderer.invoke('file-save-as-json', json, savePath);
      setSavePath(savedAsPath);
    }
  }, [reactFlowInstanceRfi, savePath]);

  useHotkeys('ctrl+s', performSave, {}, [reactFlowInstanceRfi, nodes, edges, savePath]);
  useHotkeys('ctrl+z', undo, {}, [reactFlowInstanceRfi, nodes, edges]);
  useHotkeys('ctrl+r', redo, {}, [reactFlowInstanceRfi, nodes, edges]);
  useHotkeys('ctrl+shift+z', redo, {}, [reactFlowInstanceRfi, nodes, edges]);
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

  useEffect(async () => {
    if (!loadedFromCli) {
      const contents = await ipcRenderer.invoke('get-cli-open');
      if (contents) {
        setStateFromJSON(contents, true);
        setLoadedFromCli(true);
      }
    }
  }, []);

  // Register Open File event handler
  useEffect(() => {
    ipcRenderer.on('file-open', (event, json, openedFilePath) => {
      const { version, content } = json;
      setSavePath(openedFilePath);
      if (version) {
        // TODO: Add version upgrading
        setStateFromJSON(content, true);
      } else {
        // Legacy files
        setStateFromJSON(json, true);
      }
    });

    return () => {
      ipcRenderer.removeAllListeners('file-open');
    };
  }, [savePath]);

  // Register Save/Save-As event handlers
  useEffect(() => {
    ipcRenderer.on('file-save-as', async () => {
      const json = await dumpStateToJSON();
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
  }, [reactFlowInstanceRfi, nodes, edges, savePath]);

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
    nodes.forEach((node) => {
      const inputData = node.data?.inputData;
      if (inputData) {
        Object.keys(inputData).forEach((index) => {
          result[node.id].inputs[index] = inputData[index];
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
      result[source].outputs[sourceHandle.split('-').slice(-1)] = { id: targetHandle };
      result[target].inputs[targetHandle.split('-').slice(-1)] = { id: sourceHandle };
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
    const removedElements = rfRemoveElements(elements, [...nodes, ...edges]);
    setEdges(removedElements.filter((element) => isEdge(element)));
    setNodes(removedElements.filter((element) => isNode(element)));
  };

  const removeNodeById = (id) => {
    const nodeToRemove = nodes.find((node) => node.id === id);
    const newElements = rfRemoveElements([nodeToRemove], [...nodes, ...edges]);
    setEdges(newElements.filter((element) => isEdge(element)));
    setNodes(newElements.filter((element) => isNode(element)));
  };

  const getInputDefaults = (nodeData) => {
    const defaultData = {};
    if (nodeData.inputs) {
      nodeData.inputs.forEach((input, i) => {
        if (input.def || input.def === 0) {
          defaultData[i] = input.def;
        } else if (input.default || input.default === 0) {
          defaultData[i] = input.default;
        } else if (input.options) {
          defaultData[i] = input.options[0].value;
        }
      });
    }
    return defaultData;
  };

  const createNode = ({
    type, position, data,
  }) => {
    const id = createUniqueId();
    const newNode = {
      type, id, position, data: { ...data, id, inputData: getInputDefaults(data) },
    };
    setNodes([
      ...nodes,
      newNode,
    ]);
    return id;
  };

  const createConnection = ({
    source, sourceHandle, target, targetHandle,
  }) => {
    const id = createUniqueId();
    const newEdge = {
      id,
      sourceHandle,
      targetHandle,
      source,
      target,
      type: 'main',
      animated: false,
      style: { strokeWidth: 2 },
      data: {
        sourceType: (nodes.find((n) => n.id === source))?.data.category,
      },
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

    const checkTargetChildren = (parentNode) => {
      const targetChildren = getOutgoers(parentNode, [...nodes, ...edges]);
      if (!targetChildren.length) {
        return false;
      }
      return targetChildren.some((childNode) => {
        if (childNode.id === sourceNode.id) {
          return true;
        }
        return checkTargetChildren(childNode);
      });
    };
    const isLoop = checkTargetChildren(targetNode);

    return sourceOutput.type === targetInput.type && !isLoop;
  };

  const useInputData = (id, index) => {
    const nodeById = nodes.find((node) => node.id === id) ?? {};
    const nodeData = nodeById?.data;

    if (!nodeData) {
      return [];
    }

    let inputData = nodeData?.inputData;
    if (!inputData) {
      inputData = getInputDefaults(nodeData);
    }

    const inputDataByIndex = inputData[index];
    const setInputData = (data) => {
      const nodeCopy = { ...nodeById };
      if (nodeCopy && nodeCopy.data) {
        nodeCopy.data.inputData = {
          ...inputData,
          [index]: data,
        };
      }
      const filteredNodes = nodes.filter((n) => n.id !== id);
      setNodes([
        ...filteredNodes,
        nodeCopy,
      ]);
    };
    return [inputDataByIndex, setInputData];
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

    const completeEdges = (finished) => {
      setEdges(edges.map((edge) => {
        const complete = finished.includes(edge.source);
        return {
          ...edge,
          animated: !complete,
          data: {
            ...edge.data,
            complete,
          },
        };
      }));
    };

    const clearCompleteEdges = () => {
      setEdges(edges.map((edge) => ({
        ...edge,
        animated: false,
        data: {
          ...edge.data,
          complete: false,
        },
      })));
    };

    return [animateEdges, unAnimateEdges, completeEdges, clearCompleteEdges];
  };

  // TODO: performance concern? runs twice when deleting node
  const useNodeLock = useCallback((id) => {
    // console.log('perf check (node lock)');
    const node = nodes.find((n) => n.id === id);
    if (!node) {
      return [];
    }
    const isLocked = node.data?.isLocked ?? false;
    const toggleLock = () => {
      node.draggable = isLocked;
      node.connectable = isLocked;
      node.data.isLocked = !isLocked;
      setNodes([
        ...nodes.filter((n) => n.id !== id),
        node,
      ]);
    };
    return [isLocked, toggleLock];
  }, [nodes]);

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
    const inputData = node.data.inputData ?? {};
    const filteredEdges = edges.filter((e) => e.target === id);
    // Check to make sure the node has all the data it should based on the schema.
    // Compares the schema against the connections and the entered data
    const nonOptionalInputs = inputs.filter((input) => !input.optional);
    if (nonOptionalInputs.length > Object.keys(inputData).length + filteredEdges.length) {
      // Grabs all the indexes of the inputs that the connections are targeting
      const edgeTargetIndexes = edges.filter((edge) => edge.target === id).map((edge) => edge.targetHandle.split('-').slice(-1)[0]);
      // Grab all inputs that do not have data or a connected edge
      const missingInputs = nonOptionalInputs.filter(
        (input, i) => !Object.keys(inputData).includes(String(i))
        && !edgeTargetIndexes.includes(String(i)),
      );
      // TODO: This fails to output the missing inputs when a node is connected to another
      return [false, `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`];
    }

    return [true];
  }, [edges, nodes]); // nodeData

  const duplicateNode = (id) => {
    // const rfiNodes = reactFlowInstance.getElements();
    const node = nodes.find((n) => n.id === id);
    const x = node.position.x + 200;
    const y = node.position.y + 200;
    createNode({
      type: node.type, position: { x, y }, data: node.data,
    });
  };

  const clearNode = (id) => {
    const nodesCopy = [...nodes];
    const node = nodesCopy.find((n) => n.id === id);
    node.data.inputData = getInputDefaults(node.data);
    setNodes([
      ...nodes.filter((n) => n.id !== id),
      node,
    ]);
  };

  // const cut = () => {
  //   setCopiedElements(selectedElements);
  //   removeElements(selectedElements);
  //   setSelectedElements([]);
  // };

  // const copy = () => {
  //   setCopiedElements(selectedElements);
  // };

  // const paste = () => {
  //   copiedElements.forEach((element) => {
  //     if (isNode(element)) {
  //       const node = { ...element };
  //       const x = node.position.x + 200;
  //       const y = node.position.y + 200;
  //       createNode({
  //         type: node.type, position: { x, y }, data: node.data,
  //       });
  //     } else if (isEdge(element)) {
  //       // Can't do this yet
  //     }
  //   });
  // };

  // useHotkeys('ctrl+x', cut, {}, [reactFlowInstanceRfi, selectedElements]);
  // useHotkeys('ctrl+c', copy, {}, [reactFlowInstanceRfi, selectedElements]);
  // useHotkeys('ctrl+v', paste, {}, [reactFlowInstanceRfi, selectedElements]);

  const outlineInvalidNodes = (invalidNodes) => {
    const invalidIds = invalidNodes.map((node) => node.id);
    const mappedNodes = invalidNodes.map((node) => {
      const nodeCopy = { ...node };
      nodeCopy.data.invalid = true;
      return nodeCopy;
    });
    setNodes([
      ...(nodes.filter((node) => !invalidIds.includes(node.id))),
      ...mappedNodes,
    ]);
  };

  const unOutlineInvalidNodes = (invalidNodes) => {
    const invalidIds = invalidNodes.map((node) => node.id);
    const mappedNodes = invalidNodes.map((node) => {
      const nodeCopy = { ...node };
      nodeCopy.data.invalid = false;
      return nodeCopy;
    });
    setNodes([
      ...(nodes.filter((node) => !invalidIds.includes(node.id))),
      ...mappedNodes,
    ]);
  };

  const contextValue = useMemo(() => ({
    nodes,
    edges,
    elements: [...nodes, ...edges],
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
    // setSelectedElements,
    outlineInvalidNodes,
    unOutlineInvalidNodes,
    useIsCpu: [isCpu, setIsCpu],
    useIsFp16: [isFp16, setIsFp16],
  }), [nodes, edges, isCpu, isFp16]);

  return (
    <GlobalContext.Provider value={contextValue}>
      {children}
    </GlobalContext.Provider>
  );
};
