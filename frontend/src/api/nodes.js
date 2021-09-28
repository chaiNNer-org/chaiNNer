import axios from 'axios';

// eslint-disable-next-line import/prefer-default-export
export const fetchNodes = async () => {
  const response = await axios.get('http://localhost:8000/nodes');
  return response.data;
};
