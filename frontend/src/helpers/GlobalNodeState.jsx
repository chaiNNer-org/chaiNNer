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
    }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
