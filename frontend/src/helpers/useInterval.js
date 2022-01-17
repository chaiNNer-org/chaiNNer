// Modified from: https://blog.bitsrc.io/polling-in-react-using-the-useinterval-custom-hook-e2bcefda4197

import { useEffect, useRef } from 'react';

const useInterval = (callback, delay) => {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const tick = () => {
      savedCallback.current();
    };
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => {
        clearInterval(id);
      };
    }
    return () => {};
  }, [callback, delay]);
};

export default useInterval;
