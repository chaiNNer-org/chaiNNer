/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { ipcRenderer } from 'electron';
import React, {
  createContext, useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  getOutgoers, useEdgesState, useNodesState, useReactFlow,
} from 'react-flow-renderer';
import { useHotkeys } from 'react-hotkeys-hook';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorage from './hooks/useLocalStorage.js';
import useSessionStorage from './hooks/useSessionStorage.js';
import { migrate } from './migrations.js';

export const GlobalContext = createContext({});

const createUniqueId = () => uuidv4();

export const GlobalProvider = ({
  children, nodeTypes, availableNodes, reactFlowWrapper,
}) => {
  // console.log('global state rerender');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const {
    setViewport, getViewport,
  } = useReactFlow();

  // Cache node state to avoid clearing state when refreshing
  const [cachedNodes, setCachedNodes] = useSessionStorage('cachedNodes', []);
  const [cachedEdges, setCachedEdges] = useSessionStorage('cachedEdges', []);
  const [cachedViewport, setCachedViewport] = useSessionStorage('cachedViewport', {});
  useEffect(() => {
    setCachedNodes(nodes);
    setCachedEdges(edges);
    setCachedViewport(getViewport());
  }, [nodes, edges]);
  useEffect(() => {
    setViewport(cachedViewport);
    setNodes(cachedNodes);
    setEdges(cachedEdges);
  }, []);

  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  // const [reactFlowInstanceRfi, setRfi] = useState(null);
  const [savePath, setSavePath] = useState();

  const [isCpu, setIsCpu] = useLocalStorage('is-cpu', false);
  const [isFp16, setIsFp16] = useLocalStorage('is-fp16', false);
  const [isSystemPython, setIsSystemPython] = useLocalStorage('use-system-python', false);
  const [isSnapToGrid, setIsSnapToGrid] = useLocalStorage('snap-to-grid', false);
  const [snapToGridAmount, setSnapToGridAmount] = useLocalStorage('snap-to-grid-amount', 15);

  const [loadedFromCli, setLoadedFromCli] = useSessionStorage('loaded-from-cli', false);

  const dumpStateToJSON = async () => {
    const output = JSON.stringify({
      version: await ipcRenderer.invoke('get-app-version'),
      content: {
        nodes, edges, viewport: getViewport(),
      },
      timestamp: new Date(),
    });
    return output;
  };

  const setStateFromJSON = async (savedData, loadPosition = false) => {
    if (savedData) {
      const validNodes = savedData.nodes.filter(
        (node) => availableNodes[node.data.category]
        && availableNodes[node.data.category][node.data.type],
      ) || [];
      if (savedData.nodes.length !== validNodes.length) {
        await ipcRenderer.invoke(
          'show-warning-message-box',
          'File contains invalid nodes',
          'The file you are trying to open contains nodes that are unavailable on your system. Check the dependency manager to see if you are missing any dependencies. The file will now be loaded without the incompatible nodes.',
        );
      }
      // setEdges([]);
      setNodes(validNodes);
      setEdges(
        savedData.edges
          // Filter out any edges that do not have a source or target node associated with it
          .filter((edge) => (
            validNodes.some((el) => el.id === edge.target)
              && validNodes.some((el) => el.id === edge.source)
          ))
          // Un-animate all edges, if was accidentally saved when animated
          .map((edge) => ({
            ...edge,
            animated: false,
          }))
      || [],
      );
      if (loadPosition) {
        setViewport(savedData.viewport || { x: 0, y: 0, zoom: 1 });
      }
    }
  };

  const clearState = () => {
    setEdges([]);
    setNodes([]);
    setSavePath(undefined);
    setViewport({ x: 0, y: 0, zoom: 0 });
  };

  const performSave = useCallback(async () => {
    const json = await dumpStateToJSON();
    if (savePath) {
      ipcRenderer.invoke('file-save-json', json, savePath);
    } else {
      const savedAsPath = await ipcRenderer.invoke('file-save-as-json', json, savePath);
      setSavePath(savedAsPath);
    }
  }, [savePath]);

  useHotkeys('ctrl+s', performSave, {}, [savePath]);
  // useHotkeys('ctrl+z', undo, {}, [reactFlowInstanceRfi, nodes, edges]);
  // useHotkeys('ctrl+r', redo, {}, [reactFlowInstanceRfi, nodes, edges]);
  // useHotkeys('ctrl+shift+z', redo, {}, [reactFlowInstanceRfi, nodes, edges]);
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

  useEffect(() => {
    (async () => {
      if (!loadedFromCli) {
        const contents = await ipcRenderer.invoke('get-cli-open');
        if (contents) {
          const { version, content } = contents;
          if (version) {
            const upgraded = migrate(version, content);
            await setStateFromJSON(upgraded, true);
          } else {
          // Legacy files
            const upgraded = migrate(null, content);
            await setStateFromJSON(upgraded, true);
          }
        }
      }
    })();
  }, []);

  // Register Open File event handler
  useEffect(() => {
    ipcRenderer.on('file-open', (event, json, openedFilePath) => {
      const { version, content } = json;
      setSavePath(openedFilePath);
      if (version) {
        const upgraded = migrate(version, content);
        setStateFromJSON(upgraded, true);
      } else {
        // Legacy files
        const upgraded = migrate(null, json);
        setStateFromJSON(upgraded, true);
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
  }, [savePath]);

  // Push state to undo history
  // useEffect(() => {
  //   push(dumpStateToJSON());
  // }, [nodeData, nodeLocks, reactFlowInstanceRfi, nodes, edges]);

  const convertToUsableFormat = () => {
    const result = {};

    // Set up each node in the result
    nodes.forEach((element) => {
      const { id, data } = element;
      const { category, type } = data;
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

  const removeNodeById = (id) => {
    // const nodeToRemove = nodes.find((node) => node.id === id);
    const newNodes = nodes.filter((n) => n.id !== id);
    // setEdges(newElements.filter((element) => isEdge(element)));
    setNodes(newNodes);
  };

  const removeEdgeById = (id) => {
    // const edgeToRemove = edges.find((node) => node.id === id);
    const newEdges = edges.filter((e) => e.id !== id);
    setEdges(newEdges);
  };

  const getInputDefaults = ({ category, type }) => {
    const defaultData = {};
    const { inputs } = availableNodes[category][type];
    if (inputs) {
      inputs.forEach((input, i) => {
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
      type,
      id,
      position,
      data: { ...data, id, inputData: (data.inputData ? data.inputData : getInputDefaults(data)) },
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
    const sourceNode = nodes.find((n) => n.id === source);
    const newEdge = {
      id,
      sourceHandle,
      targetHandle,
      source,
      target,
      type: 'main',
      animated: false,
      data: {},
      // style: { strokeWidth: 2 },
      // data: {
      //   sourceType: sourceNode?.data.category,
      //   sourceSubCategory: sourceNode?.data.subcategory,
      // },
    };
    setEdges([
      ...(edges.filter((edge) => edge.targetHandle !== targetHandle)),
      newEdge,
    ]);
  };

  useEffect(() => {
    const flow = JSON.parse(sessionStorage.getItem('rfi'));
    if (flow) {
      const { x = 0, y = 0, zoom = 2 } = flow.viewport;
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
      setViewport({ x, y, zoom });
    }
  }, []);

  // Updates the saved reactFlowInstance object
  // useEffect(() => {
  //   console.log('perf check setRfi');
  //   if (reactFlowInstance) {
  //     const flow = reactFlowInstance.toObject();
  //     setRfi(flow);
  //   }
  // }, [nodes, edges]);

  // Update rfi when drag and drop on drag end
  // const updateRfi = () => {
  //   if (reactFlowInstance) {
  //     const flow = reactFlowInstance.toObject();
  //     setRfi(flow);
  //   }
  // };

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

    // Target inputs, source outputs
    const { outputs } = availableNodes[sourceNode.data.category][sourceNode.data.type];
    const { inputs } = availableNodes[targetNode.data.category][targetNode.data.type];

    const sourceOutput = outputs[sourceHandleIndex];
    const targetInput = inputs[targetHandleIndex];

    const checkTargetChildren = (parentNode) => {
      const targetChildren = getOutgoers(parentNode, nodes, edges);
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
  const useNodeLock = useCallback((id, index = null) => {
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

    let isInputLocked = false;
    if (index !== undefined && index !== null) {
      const edge = edges.find((e) => e.target === id && String(e.targetHandle.split('-').slice(-1)) === String(index));
      isInputLocked = !!edge;
    }
    return [isLocked, toggleLock, isInputLocked];
  }, [nodes, edges]);

  const duplicateNode = (id) => {
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
    availableNodes,
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    createNode,
    createConnection,
    convertToUsableFormat,
    reactFlowInstance,
    setReactFlowInstance,
    // updateRfi,
    reactFlowWrapper,
    isValidConnection,
    useInputData,
    useAnimateEdges,
    removeNodeById,
    removeEdgeById,
    useNodeLock,
    duplicateNode,
    clearNode,
    // setSelectedElements,
    outlineInvalidNodes,
    unOutlineInvalidNodes,
    useIsCpu: [isCpu, setIsCpu],
    useIsFp16: [isFp16, setIsFp16],
    useIsSystemPython: [isSystemPython, setIsSystemPython],
    useSnapToGrid: [isSnapToGrid, setIsSnapToGrid, snapToGridAmount, setSnapToGridAmount],
  }), [
    nodes, edges, reactFlowInstance,
    isCpu, isFp16, isSystemPython, isSnapToGrid, snapToGridAmount,
  ]);

  return (
    <GlobalContext.Provider value={contextValue}>
      {children}
    </GlobalContext.Provider>
  );
};
