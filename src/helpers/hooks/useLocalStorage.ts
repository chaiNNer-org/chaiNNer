import { useEffect, useState } from 'react';

// TODO: Remove old localStorage code once enough time has passed that most users have migrated

const getCustomLocalStorage = (): Storage => {
  const storage: unknown = (global as any).customLocalStorage;
  if (storage === undefined) throw new Error('Custom storage not defined');
  return storage as Storage;
};

const getLocalStorageOrDefault = <T>(key: string, defaultValue: T): T => {
  const customStorage = getCustomLocalStorage();

  const stored = customStorage.getItem(key);
  const old = localStorage.getItem(key);
  if (stored === null) {
    if (old !== null) {
      customStorage.setItem(key, old);
      localStorage.removeItem(key);
      return JSON.parse(old);
    }
    return defaultValue;
  }
  return JSON.parse(stored);
};

const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState(getLocalStorageOrDefault(key, defaultValue));

  useEffect(() => {
    getCustomLocalStorage().setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
};

export default useLocalStorage;
