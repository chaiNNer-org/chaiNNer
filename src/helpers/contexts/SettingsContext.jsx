import { createContext, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

export const SettingsContext = createContext({});

export const SettingsProvider = ({ children, port }) => {
  const [isCpu, setIsCpu] = useLocalStorage('is-cpu', false);
  const [isFp16, setIsFp16] = useLocalStorage('is-fp16', false);
  const [isSystemPython, setIsSystemPython] = useLocalStorage('use-system-python', false);
  const [isSnapToGrid, setIsSnapToGrid] = useLocalStorage('snap-to-grid', false);
  const [snapToGridAmount, setSnapToGridAmount] = useLocalStorage('snap-to-grid-amount', 15);
  const [isDisHwAccel, setIsDisHwAccel] = useLocalStorage('disable-hw-accel', false);

  const useIsCpu = useMemo(() => [isCpu, setIsCpu], [isCpu]);
  const useIsFp16 = useMemo(() => [isFp16, setIsFp16], [isFp16]);
  const useIsSystemPython = useMemo(() => [isSystemPython, setIsSystemPython], [isSystemPython]);
  const useSnapToGrid = useMemo(
    () => [isSnapToGrid, setIsSnapToGrid, snapToGridAmount || 1, setSnapToGridAmount],
    [isSnapToGrid, snapToGridAmount]
  );
  const useDisHwAccel = useMemo(() => [isDisHwAccel, setIsDisHwAccel], [isDisHwAccel]);

  const contextValue = useMemo(
    () => ({
      useIsCpu,
      useIsFp16,
      useIsSystemPython,
      useSnapToGrid,
      useDisHwAccel,
      port,
    }),
    [useIsCpu, useIsFp16, useIsSystemPython, useSnapToGrid, port]
  );

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
};
