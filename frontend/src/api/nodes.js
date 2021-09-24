import axios from 'axios';

// eslint-disable-next-line import/prefer-default-export
export const fetchNodes = async () => {
  const response = await axios.get('http://localhost:8000/nodes');
  console.log('🚀 ~ file: nodes.js ~ line 6 ~ fetchNodes ~ response', response);
  return response;
};
