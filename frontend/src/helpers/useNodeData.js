/* eslint-disable import/extensions */
import { useContext, useEffect } from 'react';
import { NodeDataContext } from '../components/ReactFlowBox.jsx';
import useSessionStorage from './useSessionStorage.js';

const useNodeData = (id, defaultValue = {}) => {
  const [nodeData, setNodeData] = useContext(NodeDataContext);
  const [singleData, setSingleData] = useSessionStorage(id, nodeData[id] || defaultValue);

  useEffect(() => {
    setNodeData({
      ...nodeData,
      [id]: singleData,
    });
  }, [singleData]);

  return [singleData, setSingleData];
};

export default useNodeData;
