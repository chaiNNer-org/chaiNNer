/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import React, { createContext, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import AppReducer from './AppReducer.js';
// import useSessionStorage from './useSessionStorage.js';

const initialState = {
  elements: [],
  nodeData: {},
};

export const GlobalContext = createContext(initialState);

function createUniqueId() {
  return uuidv4();
}

export const GlobalProvider = ({ children }) => {
  // const [sessionState, setSessionState] = useSessionStorage('globalState', initialState);
  const [state, dispatch] = useReducer(AppReducer, initialState);

  //   useEffect(() => {
  //     console.log('STATE CHANGE', state.nodeData);
  //     setSessionState(state);
  //   }, [state]);

  //   useEffect(() => {
  //     console.log('sessionState', sessionState);
  //     dispatch({
  //       type: 'SET_STATE',
  //       payload: sessionState,
  //     });
  //   }, []);

  // Actions for changing state

  function convertToUsableFormat() {
    const result = {};

    // Set up each node in the result
    state.elements.forEach((element) => {
      if (element.data && !element.source) {
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
      }
    });

    // Apply input data to inputs when applicable
    state.elements.forEach((element) => {
      if (state.nodeData[element.source]) {
        const { inputData } = state.nodeData[element.source];
        if (inputData) {
          Object.keys(inputData).forEach((index) => {
            result[element.source].inputs[index] = inputData[index];
          });
        }
      }
    });

    // Apply inputs and outputs from connections
    // Note: As-is, this will overwrite inputted data from above
    state.elements.forEach((element) => {
      if (element.source && !element.data) {
        const {
          // eslint-disable-next-line no-unused-vars
          id, sourceHandle, targetHandle, source, target, type,
        } = element;
        // Connection
        result[source].outputs[sourceHandle.split('-').slice(-1)] = { id: target };
        result[target].inputs[targetHandle.split('-').slice(-1)] = { id: source };
      }
    });

    // Convert inputs and outputs to arrays
    Object.keys(result).forEach((id) => {
      result[id].inputs = Object.values(result[id].inputs);
      result[id].outputs = Object.values(result[id].outputs);
    });

    console.log(JSON.stringify(result));

    return result;
  }

  function setElements(elements) {
    dispatch({
      type: 'SET_ELEMENTS',
      payload: elements,
    });
  }

  function createNode({
    type, position, data,
  }) {
    const id = createUniqueId();
    const newNode = {
      type, id, position, data: { ...data, id },
    };
    dispatch({
      type: 'CREATE_NODE',
      payload: newNode,
    });
  }

  function createConnection({
    source, sourceHandle, target, targetHandle, type,
  }) {
    const id = createUniqueId();
    const newEdge = {
      id, sourceHandle, targetHandle, source, target, type,
    };
    dispatch({
      type: 'CREATE_EDGE',
      payload: newEdge,
    });
  }

  function removeItemFromList(item) {
    dispatch({
      type: 'REMOVE_ITEM',
      payload: item,
    });
  }

  function useNodeData(id) {
    const nodeData = state.nodeData[id];
    const setNodeDataById = (data) => {
      dispatch({
        type: 'SET_NODE_DATA',
        payload: {
          ...state.nodeData,
          [id]: {
            ...data,
          },
        },
      });
    };
    return [nodeData, setNodeDataById];
  }

  return (
    <GlobalContext.Provider value={{
      elements: state.elements,
      connections: state.connections,
      nodeData: state.nodeData,
      createNode,
      createConnection,
      removeItemFromList,
      setElements,
      useNodeData,
      convertToUsableFormat,
    }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
