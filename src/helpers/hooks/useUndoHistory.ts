import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

const useUndoHistory = <T>(maxLength: number) => {
  const [undoHistory, setUndoHistory] = useState<readonly T[]>([]);
  const [redoHistory, setRedoHistory] = useState<readonly T[]>([]);

  const undo = () => {
    if (!undoHistory.length) {
      return undefined;
    }
    const undoHistoryCopy = [...undoHistory];
    const popped = undoHistoryCopy.pop()!;
    setUndoHistory(undoHistoryCopy);
    setRedoHistory([...redoHistory, popped]);
    return popped;
  };

  const redo = () => {
    if (!redoHistory.length) {
      return undefined;
    }
    const redoHistoryCopy = [...redoHistory];
    const popped = redoHistoryCopy.pop()!;
    setRedoHistory(redoHistoryCopy);
    setUndoHistory([...undoHistory, popped]);
    return popped;
  };

  const push = (data: T) => {
    const [top] = undoHistory.slice(-1);
    // console.log('TEST', data === top);
    if (data !== top) {
      // Reset the redo history on push
      setRedoHistory([]);
      // Add new data to the undo history, and makes sure its only maxLength long
      setUndoHistory([...undoHistory, data].slice(-maxLength));
    }
  };

  const debouncedPush = useDebouncedCallback(push, 350);

  return [undo, redo, debouncedPush] as const;
};

export default useUndoHistory;
