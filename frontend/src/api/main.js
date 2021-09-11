import axios from 'axios';

// eslint-disable-next-line import/prefer-default-export
export const fetchMain = async () => {
  const response = await axios.get('http://localhost:8000/');
  return response.data;
};
