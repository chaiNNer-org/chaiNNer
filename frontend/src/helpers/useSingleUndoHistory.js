import { useState } from 'react';
// import { useDebouncedCallback } from 'use-debounce';

const useUndoHistory = (maxLength) => {
  const [previous, setPrevious] = useState(null);
  // console.log('🚀 ~ file: useSingleUndoHistory.js ~ line 6 ~ useUndoHistory ~ previous', previous);
  const [current, setCurrent] = useState(null);
  // console.log('🚀 ~ file: useSingleUndoHistory.js ~ line 6 ~ useUndoHistory ~ current', current);
  const [next, setNext] = useState(null);
  // console.log('🚀 ~ file: useSingleUndoHistory.js ~ line 8 ~ useUndoHistory ~ next', next);

  const canUndo = !!previous;
  const canRedo = !!next;

  const undo = () => {
    if (canUndo) {
      const copy = { previous, current, next };
      console.log('undoing');
      setNext(copy.current);
      setCurrent(copy.previous);
      setPrevious(null);
    }
  };

  const redo = () => {
    if (canRedo) {
      const copy = { previous, current, next };
      console.log('redoing');
      setPrevious(copy.current);
      setCurrent(copy.next);
      setNext(null);
    }
  };

  const push = (data) => {
    if (data !== current) {
      setNext(null);
      setPrevious(data.previous);
      setCurrent(data.current);
    }
  };

  // const debouncedPush = useDebouncedCallback(push, 500);

  return [undo, redo, push, previous, current, next];
};

export default useUndoHistory;
