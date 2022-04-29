import { useEffect, useState } from 'react';

// TODO: Remove old localStorage code once enough time has passed that most users have migrated

const getLocalStorageOrDefault = (key, defaultValue) => {
  const stored = global.customLocalStorage.getItem(key);
  const old = localStorage.getItem(key);
  if (stored === undefined && old !== undefined) {
    global.customLocalStorage.setItem(key, old);
    localStorage.setItem(key, undefined);
    return JSON.parse(old);
  }
  if (stored === undefined && old === undefined) {
    return defaultValue;
  }
  return JSON.parse(stored);
};

const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(getLocalStorageOrDefault(key, defaultValue));

  useEffect(() => {
    global.customLocalStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
};

export default useLocalStorage;
