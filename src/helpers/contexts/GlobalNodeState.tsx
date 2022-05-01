import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Connection,
  Edge,
  getOutgoers,
  Node,
  OnEdgesChange,
  OnNodesChange,
  useEdgesState,
  useNodesState,
  useReactFlow,
  Viewport,
  XYPosition,
} from 'react-flow-renderer';
import { useHotkeys } from 'react-hotkeys-hook';
import { v4 as uuidv4 } from 'uuid';
import { ipcRenderer } from '../safeIpc';
import useSessionStorage from '../hooks/useSessionStorage';
import { migrate } from '../migrations';
import { SettingsContext } from './SettingsContext';
import {
  EdgeData,
  InputValue,
  IteratorSize,
  NodeData,
  NodeSchema,
  SchemaMap,
  Size,
} from '../../common-types';
import { snapToGrid } from '../reactFlowUtil';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface Global {
  availableNodes: SchemaMap;
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  setNodes: SetState<Node<NodeData>[]>;
  setEdges: SetState<Edge<EdgeData>[]>;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  createNode: (proto: NodeProto) => Node<NodeData>;
  createConnection: (proto: EdgeProto) => void;
  convertToUsableFormat: () => Record<string, UsableData>;
  reactFlowWrapper: React.MutableRefObject<Element>;
  isValidConnection: (connection: Connection) => boolean;
  useInputData: (
    id: string,
    index: number
  ) => readonly [] | readonly [InputValue, (data: InputValue) => void];
  useAnimateEdges: () => ((nodeIdsToUnAnimate: readonly string[]) => void)[];
  removeNodeById: (id: string) => void;
  removeEdgeById: (id: string) => void;
  useNodeLock: (
    id: string,
    index?: number | null
  ) => readonly [] | readonly [boolean, () => void, boolean];
  duplicateNode: (id: string) => void;
  clearNode: (id: string) => void;
  outlineInvalidNodes: (invalidNodes: readonly Node<NodeData>[]) => void;
  zoom: number;
  onMoveEnd: (event: unknown, viewport: Viewport) => void;
  useIteratorSize: (
    id: string
  ) => readonly [setSize: (size: IteratorSize) => void, defaultSize: Size];
  updateIteratorBounds: (id: string, iteratorSize: IteratorSize, dimensions?: Size) => void;
  setIteratorPercent: (id: string, percent: number) => void;
  closeAllMenus: () => void;
  useHoveredNode: readonly [string | null, SetState<string | null>];
  useMenuCloseFunctions: readonly [
    closeAllMenus: () => void,
    addMenuCloseFunction: (func: () => void, id: string) => void
  ];
}

interface UsableData {
  category: string;
  node: string;
  id: string;
  inputs: Record<number, InputValue>;
  outputs: Record<number, InputValue>;
  child: boolean;
  children?: string[];
  nodeType: string | undefined;
  percent?: number;
}
interface NodeProto {
  position: XYPosition;
  data: NodeData;
  nodeType: string;
  defaultNodes?: NodeSchema[];
  parent?: string | Node<NodeData> | null;
}
type EdgeProto = Pick<Edge<EdgeData>, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>;

// TODO: Find default
export const GlobalContext = createContext<Readonly<Global>>({} as Global);

const createUniqueId = () => uuidv4();

interface GlobalProviderProps {
  availableNodes: SchemaMap;
  reactFlowWrapper: React.MutableRefObject<Element>;
}

interface SaveFile {
  version: string;
  timestamp: string;
  content: SaveData;
}
interface SaveData {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
  viewport: Viewport;
}

const getSaveData = (json: unknown): SaveData => {
  const data = json as SaveFile | { version: undefined };
  if (data.version) {
    return migrate(data.version, data.content) as SaveData;
  }
  // Legacy files
  return migrate(null, data) as SaveData;
};

interface ParsedHandle {
  id: string;
  index: number;
}
const parseHandle = (handle: string): ParsedHandle => {
  return {
    id: handle.substring(0, 36), // uuid
    index: Number(handle.substring(37)),
  };
};

const getInputDefaults = ({ category, type }: NodeData, availableNodes: SchemaMap) => {
  const defaultData: Record<number, InputValue> = {};
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

export const GlobalProvider = ({
  children,
  availableNodes,
  reactFlowWrapper,
}: React.PropsWithChildren<GlobalProviderProps>) => {
  // console.log('global state rerender');

  const { useSnapToGrid } = useContext(SettingsContext);

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);
  const { setViewport, getViewport } = useReactFlow();

  // Cache node state to avoid clearing state when refreshing
  const [cachedNodes, setCachedNodes] = useSessionStorage<Node<NodeData>[]>('cachedNodes', []);
  const [cachedEdges, setCachedEdges] = useSessionStorage<Edge<EdgeData>[]>('cachedEdges', []);
  const [cachedViewport, setCachedViewport] = useSessionStorage<Viewport | null>(
    'cachedViewport',
    null
  );
  useEffect(() => {
    setCachedNodes(nodes);
    setCachedEdges(edges);
    setCachedViewport(getViewport());
  }, [nodes, edges]);
  useEffect(() => {
    if (cachedViewport) setViewport(cachedViewport);
    setNodes(cachedNodes);
    setEdges(cachedEdges);
  }, []);

  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  // const [reactFlowInstanceRfi, setRfi] = useState(null);
  const [savePath, setSavePath] = useState<string | undefined>();

  const [loadedFromCli] = useSessionStorage('loaded-from-cli', false);

  const [menuCloseFunctions, setMenuCloseFunctions] = useState<Record<string, () => void>>({});

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const [, , snapToGridAmount] = useSnapToGrid;

  const dumpStateToJSON = async () => {
    const output = JSON.stringify({
      version: await ipcRenderer.invoke('get-app-version'),
      content: {
        nodes,
        edges,
        viewport: getViewport(),
      },
      timestamp: new Date(),
    });
    return output;
  };

  const setStateFromJSON = async (savedData: SaveData, loadPosition = false) => {
    if (savedData) {
      const validNodes = savedData.nodes.filter(
        (node) =>
          availableNodes[node.data.category] && availableNodes[node.data.category][node.data.type]
      );
      if (savedData.nodes.length !== validNodes.length) {
        await ipcRenderer.invoke(
          'show-warning-message-box',
          'File contains invalid nodes',
          'The file you are trying to open contains nodes that are unavailable on your system. Check the dependency manager to see if you are missing any dependencies. The file will now be loaded without the incompatible nodes.'
        );
      }
      setNodes(validNodes);
      setEdges(
        savedData.edges
          // Filter out any edges that do not have a source or target node associated with it
          .filter(
            (edge) =>
              validNodes.some((el) => el.id === edge.target) &&
              validNodes.some((el) => el.id === edge.source)
          )
          // Un-animate all edges, if was accidentally saved when animated
          .map((edge) => ({
            ...edge,
            animated: false,
          })) || []
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

  const performSave = useCallback(() => {
    (async () => {
      const json = await dumpStateToJSON();
      if (savePath) {
        await ipcRenderer.invoke('file-save-json', json, savePath);
      } else {
        const savedAsPath = await ipcRenderer.invoke('file-save-as-json', json, savePath);
        setSavePath(savedAsPath);
      }
    })();
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
          await setStateFromJSON(getSaveData(contents), true);
        }
      }
    })();
  }, []);

  // Register Open File event handler
  useEffect(() => {
    ipcRenderer.on('file-open', (event, json, openedFilePath) => {
      setSavePath(openedFilePath);
      // TODO: handle promise
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      setStateFromJSON(getSaveData(json), true);
    });

    return () => {
      ipcRenderer.removeAllListeners('file-open');
    };
  }, [savePath]);

  // Register Save/Save-As event handlers
  useEffect(() => {
    ipcRenderer.on('file-save-as', () => {
      (async () => {
        const json = await dumpStateToJSON();
        const savedAsPath = await ipcRenderer.invoke('file-save-as-json', json, savePath);
        setSavePath(savedAsPath);
      })();
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
    const result: Record<string, UsableData> = {};

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
        result[id].percent = data.percentComplete || 0;
      }
    });

    // Apply input data to inputs when applicable
    nodes.forEach((node) => {
      const inputData = node.data?.inputData;
      if (inputData) {
        Object.keys(inputData)
          .map(Number)
          .forEach((index) => {
            result[node.id].inputs[index] = inputData[index];
          });
      }
      if (node.parentNode) {
        result[node.parentNode].children!.push(node.id);
        result[node.id].child = true;
      }
    });

    // Apply inputs and outputs from connections
    // Note: As-is, this will overwrite inputted data from above
    edges.forEach((element) => {
      const { sourceHandle, targetHandle, source, target } = element;
      // Connection
      if (result[source] && result[target] && sourceHandle && targetHandle) {
        result[source].outputs[parseHandle(sourceHandle).index] = { id: targetHandle };
        result[target].inputs[parseHandle(targetHandle).index] = { id: sourceHandle };
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

  const removeNodeById = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (node && node.type !== 'iteratorHelper') {
        const newNodes = nodes.filter((n) => n.id !== id && n.parentNode !== id);
        setNodes(newNodes);
      }
    },
    [nodes, setNodes]
  );

  const removeEdgeById = useCallback(
    (id: string) => {
      const newEdges = edges.filter((e) => e.id !== id);
      setEdges(newEdges);
    },
    [edges, setEdges]
  );

  const createNode = useCallback(
    ({ position, data, nodeType, defaultNodes = [], parent = null }: NodeProto): Node<NodeData> => {
      const id = createUniqueId();
      const newNode: Node<NodeData> = {
        type: nodeType,
        id,
        position: snapToGrid(position, snapToGridAmount),
        data: { ...data, id, inputData: data.inputData ?? getInputDefaults(data, availableNodes) },
      };
      if (parent || (hoveredNode && nodeType !== 'iterator')) {
        let parentNode: Node<NodeData> | null | undefined;
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
          const { width, height, offsetTop, offsetLeft } = parentNode.data.iteratorSize ?? {
            width: 480,
            height: 480,
            offsetTop: 0,
            offsetLeft: 0,
          };
          const parentId = (parentNode?.id || hoveredNode) ?? undefined;
          newNode.position.x = position.x - parentNode.position.x;
          newNode.position.y = position.y - parentNode.position.y;
          newNode.parentNode = parentId;
          newNode.data.parentNode = parentId;
          newNode.extent = [
            [offsetLeft, offsetTop],
            [width, height],
          ];
        }
      }
      const extraNodes: Node<NodeData>[] = [];
      if (nodeType === 'iterator') {
        newNode.data.iteratorSize = { width: 480, height: 480, offsetTop: 0, offsetLeft: 0 };
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
        setNodes([...nodes, newNode, ...extraNodes]);
      }
      return newNode;
    },
    [nodes, setNodes, availableNodes, hoveredNode, availableNodes]
  );

  const createConnection = useCallback(
    ({ source, sourceHandle, target, targetHandle }: EdgeProto) => {
      const id = createUniqueId();
      const newEdge: Edge<EdgeData> = {
        id,
        sourceHandle,
        targetHandle,
        source,
        target,
        type: 'main',
        animated: false,
        data: {},
      };
      setEdges([...edges.filter((edge) => edge.targetHandle !== targetHandle), newEdge]);
    },
    [edges, setEdges]
  );

  useEffect(() => {
    const json = sessionStorage.getItem('rfi');
    if (!json) return;
    const flow = JSON.parse(json) as {
      viewport?: Viewport;
      nodes?: Node<NodeData>[];
      edges?: Edge<EdgeData>[];
    };
    if (flow) {
      const { x = 0, y = 0, zoom = 2 } = flow.viewport ?? {};
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
      setViewport({ x, y, zoom });
    }
  }, []);

  const isValidConnection = useCallback(
    ({ target, targetHandle, source, sourceHandle }: Connection) => {
      if (source === target || !sourceHandle || !targetHandle) {
        return false;
      }
      const sourceHandleIndex = parseHandle(sourceHandle).index;
      const targetHandleIndex = parseHandle(targetHandle).index;

      const sourceNode = nodes.find((node) => node.id === source);
      const targetNode = nodes.find((node) => node.id === target);
      if (!sourceNode || !targetNode) {
        return false;
      }

      // Target inputs, source outputs
      const { outputs } = availableNodes[sourceNode.data.category][sourceNode.data.type];
      const { inputs } = availableNodes[targetNode.data.category][targetNode.data.type];

      const sourceOutput = outputs[sourceHandleIndex];
      const targetInput = inputs[targetHandleIndex];

      const checkTargetChildren = (parentNode: Node<NodeData>): boolean => {
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

      const iteratorLock =
        !sourceNode.parentNode || sourceNode.parentNode === targetNode.parentNode;

      return sourceOutput.type === targetInput.type && !isLoop && iteratorLock;
    },
    [nodes, edges, availableNodes]
  );

  const useInputData = useCallback(
    (id: string, index: number) => {
      const nodeById = nodes.find((node) => node.id === id);
      const nodeData = nodeById?.data;

      if (!nodeData) {
        return [] as const;
      }

      let inputData = nodeData?.inputData;
      if (!inputData) {
        inputData = getInputDefaults(nodeData, availableNodes);
      }

      const inputDataByIndex = inputData[index];
      const setInputData = (data: InputValue) => {
        const nodeCopy: Node<NodeData> = { ...nodeById };
        if (nodeCopy && nodeCopy.data) {
          nodeCopy.data.inputData = {
            ...inputData,
            [index]: data,
          };
        }
        const filteredNodes = nodes.filter((n) => n.id !== id);
        setNodes([...filteredNodes, nodeCopy]);
      };
      return [inputDataByIndex, setInputData] as const;
    },
    [nodes, setNodes, availableNodes]
  );

  const useAnimateEdges = useCallback(() => {
    const animateEdges = () => {
      setEdges(
        edges.map((edge) => ({
          ...edge,
          animated: true,
        }))
      );
    };

    const unAnimateEdges = (nodeIdsToUnAnimate: readonly string[]) => {
      if (nodeIdsToUnAnimate) {
        const edgesToUnAnimate = edges.filter((e) => nodeIdsToUnAnimate.includes(e.source));
        const unanimatedEdges = edgesToUnAnimate.map((edge) => ({
          ...edge,
          animated: false,
        }));
        const otherEdges = edges.filter((e) => !nodeIdsToUnAnimate.includes(e.source));
        setEdges([...otherEdges, ...unanimatedEdges]);
      } else {
        setEdges(
          edges.map((edge) => ({
            ...edge,
            animated: false,
          }))
        );
      }
    };

    const completeEdges = (finished: readonly string[]) => {
      setEdges(
        edges.map((edge): Edge<EdgeData> => {
          const complete = finished.includes(edge.source);
          return {
            ...edge,
            animated: !complete,
            data: {
              ...edge.data,
              complete,
            },
          };
        })
      );
    };

    const clearCompleteEdges = () => {
      setEdges(
        edges.map((edge): Edge<EdgeData> => {
          return {
            ...edge,
            animated: false,
            data: {
              ...edge.data,
              complete: false,
            },
          };
        })
      );
    };

    return [animateEdges, unAnimateEdges, completeEdges, clearCompleteEdges];
  }, [edges, setEdges]);

  // TODO: performance concern? runs twice when deleting node
  const useNodeLock = useCallback(
    (id: string, index?: number | null) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) {
        return [] as const;
      }
      const isLocked = node.data?.isLocked ?? false;
      const toggleLock = () => {
        node.draggable = isLocked;
        node.connectable = isLocked;
        node.data.isLocked = !isLocked;
        setNodes([...nodes.filter((n) => n.id !== id), node]);
      };

      let isInputLocked = false;
      if (index !== undefined && index !== null) {
        const edge = edges.find(
          (e) => e.target === id && !!e.targetHandle && parseHandle(e.targetHandle).index === index
        );
        isInputLocked = !!edge;
      }
      return [isLocked, toggleLock, isInputLocked] as const;
    },
    [nodes, edges, setNodes]
  );

  const useIteratorSize = useCallback(
    (id: string) => {
      const defaultSize: Size = { width: 480, height: 480 };
      // TODO: What happens when the node wasn't found?
      const node = nodes.find((n) => n.id === id)!;

      const setIteratorSize = (size: IteratorSize) => {
        node.data.iteratorSize = size;
        setNodes([...nodes.filter((n) => n.id !== id), node]);
      };

      return [setIteratorSize, defaultSize] as const;
    },
    [nodes, setNodes]
  );

  // TODO: this can probably be cleaned up but its good enough for now
  const updateIteratorBounds = useCallback(
    (id: string, iteratorSize: IteratorSize, dimensions?: Size) => {
      const nodesToUpdate = nodes.filter((n) => n.parentNode === id);
      const iteratorNode = nodes.find((n) => n.id === id);
      if (iteratorNode && nodesToUpdate.length > 0) {
        const { width, height, offsetTop, offsetLeft } = iteratorSize;
        let maxWidth = 256;
        let maxHeight = 256;
        nodesToUpdate.forEach((n) => {
          maxWidth = Math.max(n.width ?? dimensions?.width ?? maxWidth, maxWidth);
          maxHeight = Math.max(n.height ?? dimensions?.height ?? maxHeight, maxHeight);
        });
        const newNodes = nodesToUpdate.map((n) => {
          const newNode: Node<NodeData> = { ...n };
          const wBound = width - (n.width ?? dimensions?.width ?? 0) + offsetLeft;
          const hBound = height - (n.height ?? dimensions?.height ?? 0) + offsetTop;
          newNode.extent = [
            [offsetLeft, offsetTop],
            [wBound, hBound],
          ];
          newNode.position.x = Math.min(Math.max(newNode.position.x, offsetLeft), wBound);
          newNode.position.y = Math.min(Math.max(newNode.position.y, offsetTop), hBound);
          return newNode;
        });
        const newIteratorNode: Node<NodeData> = { ...iteratorNode };

        newIteratorNode.data.maxWidth = maxWidth;
        newIteratorNode.data.maxHeight = maxHeight;
        // TODO: prove that those non-null assertions are valid or make them unnecessary
        newIteratorNode.data.iteratorSize!.width = width < maxWidth ? maxWidth : width;
        newIteratorNode.data.iteratorSize!.height = height < maxHeight ? maxHeight : height;
        setNodes([
          newIteratorNode,
          ...nodes.filter((n) => n.parentNode !== id && n.id !== id),
          ...newNodes,
        ]);
      }
    },
    [nodes, setNodes]
  );

  const setIteratorPercent = useCallback(
    (id: string, percent: number) => {
      const iterator = nodes.find((n) => n.id === id);
      if (iterator && iterator.data) {
        iterator.data.percentComplete = percent;
        const filteredNodes = nodes.filter((n) => n.id !== id);
        setNodes([iterator, ...filteredNodes]);
      }
    },
    [nodes, setNodes]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      const newId = createUniqueId();
      const newNode = {
        ...node,
        id: newId,
        position: {
          x: (node.position.x || 0) + 200,
          y: (node.position.y || 0) + 200,
        },
        data: {
          ...node.data,
          id: newId,
        },
        selected: false,
      };
      const newNodes: Node<NodeData>[] = [newNode];
      const newEdges: Edge<EdgeData>[] = [];
      if (node.type === 'iterator') {
        const oldToNewIdMap: Record<string, string> = {};
        const childNodes = nodes.filter((n) => n.parentNode === id);
        childNodes.forEach((c) => {
          const newChildId = createUniqueId();
          oldToNewIdMap[c.id] = newChildId;
          const newChild = {
            ...c,
            id: newChildId,
            position: { ...c.position },
            data: {
              ...c.data,
              id: newChildId,
              parentNode: newId,
            },
            parentNode: newId,
            selected: false,
          };
          newNodes.push(newChild);
        });
        const oldChildIds = Object.keys(oldToNewIdMap);
        const childEdges = edges.filter((e) => oldChildIds.includes(e.target));
        childEdges.forEach((e) => {
          const { source, sourceHandle, target, targetHandle } = e;
          if (!sourceHandle || !targetHandle) return;
          const newEdgeId = createUniqueId();
          const newSource = oldToNewIdMap[source];
          const newTarget = oldToNewIdMap[target];
          const newSourceHandle = sourceHandle.replace(source, newSource);
          const newTargetHandle = targetHandle.replace(target, newTarget);
          const newEdge: Edge<EdgeData> = {
            ...e,
            id: newEdgeId,
            source: newSource,
            sourceHandle: newSourceHandle,
            target: newTarget,
            targetHandle: newTargetHandle,
          };
          newEdges.push(newEdge);
        });
      }
      setNodes([...nodes, ...newNodes]);
      setEdges([...edges, ...newEdges]);
    },
    [nodes, edges, availableNodes]
  );

  const clearNode = (id: string) => {
    const nodesCopy = [...nodes];
    const node = nodesCopy.find((n) => n.id === id);
    if (!node) return;
    node.data.inputData = getInputDefaults(node.data, availableNodes);
    setNodes([...nodes.filter((n) => n.id !== id), node]);
  };

  const outlineInvalidNodes = (invalidNodes: readonly Node<NodeData>[]) => {
    const invalidIds = invalidNodes.map((node) => node.id);
    const mappedNodes = invalidNodes.map((node) => {
      const nodeCopy = { ...node };
      nodeCopy.data.invalid = true;
      return nodeCopy;
    });
    setNodes([...nodes.filter((node) => !invalidIds.includes(node.id)), ...mappedNodes]);
  };

  const unOutlineInvalidNodes = (invalidNodes: readonly Node<NodeData>[]) => {
    const invalidIds = invalidNodes.map((node) => node.id);
    const mappedNodes = invalidNodes.map((node) => {
      const nodeCopy = { ...node };
      nodeCopy.data.invalid = false;
      return nodeCopy;
    });
    setNodes([...nodes.filter((node) => !invalidIds.includes(node.id)), ...mappedNodes]);
  };

  const [zoom, setZoom] = useState(1);
  const onMoveEnd = (event: unknown, viewport: Viewport) => {
    setZoom(viewport.zoom);
  };

  const addMenuCloseFunction = useCallback(
    (func: () => void, id: string) => {
      const menuFuncs = { ...menuCloseFunctions };
      menuFuncs[id] = func;
      setMenuCloseFunctions(menuFuncs);
    },
    [menuCloseFunctions, setMenuCloseFunctions]
  );

  const closeAllMenus = useCallback(() => {
    Object.keys(menuCloseFunctions).forEach((id) => {
      menuCloseFunctions[id]();
    });
  }, [menuCloseFunctions]);

  const contextValue = useMemo<Global>(
    () => ({
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
      closeAllMenus,
      useHoveredNode: [hoveredNode, setHoveredNode] as const,
      useMenuCloseFunctions: [closeAllMenus, addMenuCloseFunction] as const,
    }),
    [nodes, edges, reactFlowInstance, zoom, hoveredNode, menuCloseFunctions]
  );

  return <GlobalContext.Provider value={contextValue}>{children}</GlobalContext.Provider>;
};
