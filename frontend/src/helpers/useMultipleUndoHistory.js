import { useState } from 'react';

const useUndoHistory = (maxLength) => {
  const [previous, setPrevious] = useState([]);
  const [current, setCurrent] = useState(null);
  const [next, setNext] = useState([]);

  const undo = () => {
    if (previous.length > 0) {
      const copy = { previous, current, next };
      setNext([...next, copy.current]);
      const popped = copy.previous.pop();
      setCurrent(popped);
      setPrevious(copy.previous);
    }
  };

  const redo = () => {
    if (next.length > 0) {
      const copy = { previous, current, next };
      setPrevious([...previous, copy.current]);
      const popped = copy.next.pop();
      setCurrent(popped);
      setNext(copy.next);
    }
  };

  const push = (data) => {
    if (data !== current) {
      if (next.length) {
        setNext([]);
      }
      if (current) {
        if (previous.length) {
          setPrevious([...previous, current].slice(-maxLength));
        } else {
          setPrevious([current]);
        }
      }
      setCurrent(data);
    }
  };

  return [undo, redo, push, current];
};

export default useUndoHistory;
