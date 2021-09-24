import axios from 'axios';
// import EventEmitter from 'events';

// export const loadingEvents = new EventEmitter();

// eslint-disable-next-line import/prefer-default-export
export const fetchNodes = async () => {
  const response = await axios.get('http://localhost:8000/nodes');
  // if (response.data) {
  //   loadingEvents.emit('finished');
  // }
  return response.data;
};
