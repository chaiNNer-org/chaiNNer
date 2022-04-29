import { useEffect, useState } from 'react';

const getSessionStorageOrDefault = <T>(key: string, defaultValue: T): T => {
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    return defaultValue;
  }
  return JSON.parse(stored);
};

const useSessionStorage = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState(getSessionStorageOrDefault(key, defaultValue));

  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
};

export default useSessionStorage;
