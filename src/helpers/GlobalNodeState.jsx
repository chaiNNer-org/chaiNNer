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
  children, availableNodes, reactFlowWrapper, port,
}) => {
  console.log('🚀 ~ file: GlobalNodeState.jsx ~ line 23 ~ port', port);
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

  const [hoveredNode, setHoveredNode] = useState(null);

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
  }, [nodes, edges, savePath]);

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
  }, [nodes, edges, savePath]);

  // Push state to undo history
  // useEffect(() => {
  //   push(dumpStateToJSON());
  // }, [nodeData, nodeLocks, reactFlowInstanceRfi, nodes, edges]);

  const convertToUsableFormat = useCallback(() => {
    const result = {};

    // Set up each node in the result
    nodes.forEach((element) => {
      const { id, data, type: nodeType } = element;
      const { category, type } = data;
      // Node
      result[id] = {
        category,
        node: type,
        id,
        inputs: {},
        outputs: {},
        child: false,
        nodeType,
      };
      if (nodeType === 'iterator') {
        result[id].children = [];
      }
    });

    // Apply input data to inputs when applicable
    nodes.forEach((node) => {
      const inputData = node.data?.inputData;
      if (inputData) {
        Object.keys(inputData).forEach((index) => {
          result[node.id].inputs[index] = inputData[index];
        });
      }
      if (node.parentNode) {
        result[node.parentNode].children.push(node.id);
        result[node.id].child = true;
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
      if (result[source] && result[target]) {
        result[source].outputs[sourceHandle.split('-').slice(-1)] = { id: targetHandle };
        result[target].inputs[targetHandle.split('-').slice(-1)] = { id: sourceHandle };
      }
    });

    // Convert inputs and outputs to arrays
    Object.keys(result).forEach((id) => {
      result[id].inputs = Object.values(result[id].inputs);
      result[id].outputs = Object.values(result[id].outputs);
    });

    // console.log('convert', result);

    return result;
  }, [nodes, edges]);

  const removeNodeById = useCallback((id) => {
    if (nodes.find((n) => n.id === id).nodeType !== 'iteratorHelper') {
      const newNodes = nodes.filter((n) => n.id !== id && n.parentNode !== id);
      setNodes(newNodes);
    }
  }, [nodes, setNodes]);

  const removeEdgeById = useCallback((id) => {
    const newEdges = edges.filter((e) => e.id !== id);
    setEdges(newEdges);
  }, [edges, setEdges]);

  const getInputDefaults = useCallback(({ category, type }) => {
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
  }, [availableNodes]);

  const createNode = useCallback(({
    position, data, nodeType, defaultNodes = [], parent = null,
  }) => {
    const id = createUniqueId();
    const newNode = {
      type: nodeType,
      id,
      // This looks stupid, but the child position was overwriting the parent's because shallow copy
      position: { ...position },
      data: { ...data, id, inputData: (data.inputData ? data.inputData : getInputDefaults(data)) },
    };
    if (parent || (hoveredNode && nodeType !== 'iterator')) {
      let parentNode;
      if (typeof parent === 'string' || parent instanceof String) {
        parentNode = nodes.find((n) => n.id === parent);
        // eslint-disable-next-line no-param-reassign
        parent = null; // This is so it actually set the nodes
      } else if (parent) {
        parentNode = parent;
      } else {
        parentNode = nodes.find((n) => n.id === hoveredNode);
      }
      if (parentNode && parentNode.type === 'iterator' && newNode.type !== 'iterator') {
        const {
          width, height, offsetTop, offsetLeft,
        } = parentNode.data.iteratorSize ? parentNode.data.iteratorSize : {
          width: 480, height: 480, offsetTop: 0, offsetLeft: 0,
        };
        newNode.position.x = position.x - parentNode.position.x;
        newNode.position.y = position.y - parentNode.position.y;
        newNode.parentNode = parentNode?.id || hoveredNode;
        newNode.data.parentNode = parentNode?.id || hoveredNode;
        newNode.extent = [[offsetLeft, offsetTop], [width, height]];
      }
    }
    const extraNodes = [];
    if (nodeType === 'iterator') {
      newNode.data.iteratorSize = {
        width: 480, height: 480, offsetTop: 0, offsetLeft: 0,
      };
      defaultNodes.forEach(({ category, name }) => {
        const subNodeData = availableNodes[category][name];
        const subNode = createNode({
          nodeType: subNodeData.nodeType,
          position: newNode.position,
          data: {
            category,
            type: name,
            subcategory: subNodeData.subcategory,
            icon: subNodeData.icon,
          },
          parent: newNode,
        });
        extraNodes.push(subNode);
      });
    }
    if (!parent) {
      setNodes([
        ...nodes,
        newNode,
        ...extraNodes,
      ]);
    }
    return newNode;
  }, [nodes, setNodes, availableNodes, hoveredNode, getInputDefaults]);

  const createConnection = useCallback(({
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
      data: {},
    };
    setEdges([
      ...(edges.filter((edge) => edge.targetHandle !== targetHandle)),
      newEdge,
    ]);
  }, [edges, setEdges]);

  useEffect(() => {
    const flow = JSON.parse(sessionStorage.getItem('rfi'));
    if (flow) {
      const { x = 0, y = 0, zoom = 2 } = flow.viewport;
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
      setViewport({ x, y, zoom });
    }
  }, []);

  const isValidConnection = useCallback(({
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

    const iteratorLock = !sourceNode.parentNode || sourceNode.parentNode === targetNode.parentNode;

    return sourceOutput.type === targetInput.type && !isLoop && iteratorLock;
  }, [nodes, edges, availableNodes]);

  const useInputData = useCallback((id, index) => {
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
  }, [nodes, setNodes]);

  const useAnimateEdges = useCallback(() => {
    const animateEdges = () => {
      setEdges(edges.map((edge) => ({
        ...edge,
        animated: true,
      })));
    };

    const unAnimateEdges = (nodeIdsToUnAnimate) => {
      if (nodeIdsToUnAnimate) {
        const edgesToUnAnimate = edges.filter((e) => nodeIdsToUnAnimate.includes(e.source));
        const unanimatedEdges = edgesToUnAnimate.map((edge) => ({
          ...edge,
          animated: false,
        }));
        const otherEdges = edges.filter((e) => !nodeIdsToUnAnimate.includes(e.source));
        setEdges([
          ...otherEdges,
          ...unanimatedEdges,
        ]);
      } else {
        setEdges(edges.map((edge) => ({
          ...edge,
          animated: false,
        })));
      }
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
  }, [edges, setEdges]);

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
  }, [nodes, edges, setNodes]);

  const useIteratorSize = useCallback((id) => {
    const defaultSize = { width: 480, height: 480 };
    const node = nodes.find((n) => n.id === id);

    const setIteratorSize = (size) => {
      node.data.iteratorSize = size;
      setNodes([
        ...nodes.filter((n) => n.id !== id),
        node,
      ]);
    };

    return [setIteratorSize, defaultSize];
  }, [nodes, setNodes]);

  // TODO: this can probably be cleaned up but its good enough for now
  const updateIteratorBounds = useCallback((id, iteratorSize, dimensions) => {
    const nodesToUpdate = nodes.filter((n) => n.parentNode === id);
    const iteratorNode = nodes.find((n) => n.id === id);
    if (nodesToUpdate.length > 0) {
      const {
        width, height, offsetTop, offsetLeft,
      } = iteratorSize;
      let maxWidth = 256;
      let maxHeight = 256;
      nodesToUpdate.forEach((n) => {
        maxWidth = Math.max(n.width || dimensions?.width || maxWidth, maxWidth);
        maxHeight = Math.max(n.height || dimensions?.height || maxHeight, maxHeight);
      });
      const newNodes = nodesToUpdate.map((n) => {
        const newNode = { ...n };
        const wBound = width - (n.width || dimensions?.width || 0) + offsetLeft;
        const hBound = height - (n.height || dimensions?.height || 0) + offsetTop;
        newNode.extent = [[offsetLeft, offsetTop], [wBound, hBound]];
        newNode.position.x = Math.min(Math.max(newNode.position.x, offsetLeft), wBound);
        newNode.position.y = Math.min(Math.max(newNode.position.y, offsetTop), hBound);
        return newNode;
      });
      const newIteratorNode = { ...iteratorNode };

      newIteratorNode.data.maxWidth = maxWidth;
      newIteratorNode.data.maxHeight = maxHeight;
      newIteratorNode.data.iteratorSize.width = width < maxWidth ? maxWidth : width;
      newIteratorNode.data.iteratorSize.height = height < maxHeight ? maxHeight : height;
      setNodes([
        newIteratorNode,
        ...nodes.filter((n) => n.parentNode !== id && n.id !== id),
        ...newNodes,
      ]);
    }
  }, [nodes, setNodes]);

  const setIteratorPercent = useCallback((id, percent) => {
    const iterator = nodes.find((n) => n.id === id);
    if (iterator && iterator.data) {
      iterator.data.percentComplete = percent;
    }
    const filteredNodes = nodes.filter((n) => n.id !== id);
    setNodes([
      iterator,
      ...filteredNodes,
    ]);
  }, [nodes, setNodes]);

  const duplicateNode = useCallback((id) => {
    const node = nodes.find((n) => n.id === id);
    const x = node.position.x + 200;
    const y = node.position.y + 200;
    let defaultNodes = [];
    if (node.type === 'iterator') {
      const childNodes = nodes.filter((n) => n.parentNode === id);
      defaultNodes = childNodes.map((c) => ({ category: c.data.category, name: c.data.type }));
    }
    createNode({
      nodeType: node.type,
      position: { x, y },
      data: node.data,
      defaultNodes,
      parent: node.parentNode,
    });
  }, [nodes, availableNodes]);

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

  const [zoom, setZoom] = useState(1);
  const onMoveEnd = (event, viewport) => {
    setZoom(viewport.zoom);
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
    zoom,
    onMoveEnd,
    useIteratorSize,
    updateIteratorBounds,
    setIteratorPercent,
    useIsCpu: [isCpu, setIsCpu],
    useIsFp16: [isFp16, setIsFp16],
    useIsSystemPython: [isSystemPython, setIsSystemPython],
    useSnapToGrid: [isSnapToGrid, setIsSnapToGrid, snapToGridAmount, setSnapToGridAmount],
    useHoveredNode: [hoveredNode, setHoveredNode],
    port,
  }), [
    nodes, edges, reactFlowInstance,
    isCpu, isFp16, isSystemPython, isSnapToGrid, snapToGridAmount,
    zoom, hoveredNode, port,
  ]);

  return (
    <GlobalContext.Provider value={contextValue}>
      {children}
    </GlobalContext.Provider>
  );
};
