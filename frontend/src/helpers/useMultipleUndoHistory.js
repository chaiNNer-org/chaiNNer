import { useState } from 'react';
// import { useDebouncedCallback } from 'use-debounce';

const useUndoHistory = (maxLength) => {
  const [previous, setPrevious] = useState([]);
  // console.log('🚀 ~ file: useSingleUndoHistory.js ~ line 6 ~ useUndoHistory ~ previous', previous);
  const [current, setCurrent] = useState(null);
  // console.log('🚀 ~ file: useSingleUndoHistory.js ~ line 6 ~ useUndoHistory ~ current', current);
  const [next, setNext] = useState([]);
  // console.log('🚀 ~ file: useSingleUndoHistory.js ~ line 8 ~ useUndoHistory ~ next', next);

  const canUndo = !!previous.length;
  const canRedo = !!next.length;

  const undo = () => {
    if (canUndo) {
      console.log('undoing');
      const copy = { previous, current, next };
      console.log('[...next, copy.current]', [...next, copy.current]);
      setNext([...next, copy.current]);
      console.log('copy.previous.slice(-1)[0]', copy.previous.slice(-1)[0]);
      setCurrent(copy.previous.slice(-1)[0]);
      console.log('copy.previous.slice(0, -1)', copy.previous.slice(0, -1));
      setPrevious(copy.previous.slice(0, -1));
    }
  };

  const redo = () => {
    if (canRedo) {
      console.log('redoing');
      const copy = { previous, current, next };
      setPrevious([...previous, copy.current]);
      setCurrent(copy.next.slice(-1)[0]);
      setNext(copy.next.slice(0, -1));
    }
  };

  const push = (data) => {
    if (data !== current) {
      setNext([]);
      setPrevious([...previous, data.previous].slice(-maxLength));
      setCurrent(data.current);
    }
  };

  // const debouncedPush = useDebouncedCallback(push, 500);

  return [undo, redo, push, previous, current, next];
};

export default useUndoHistory;
