import { useColorMode } from '@chakra-ui/react';
import React, { memo, useEffect } from 'react';
import { createContext } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { GetSetState, SetState } from '../helpers/types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useMemoArray, useMemoObject } from '../hooks/useMemo';

interface Settings {
    // Global settings
    useIsCpu: GetSetState<boolean>;
    useIsFp16: GetSetState<boolean>;
    usePyTorchGPU: GetSetState<number>;
    useNcnnGPU: GetSetState<number>;
    useOnnxGPU: GetSetState<number>;
    useOnnxExecutionProvider: GetSetState<string>;
    useOnnxShouldTensorRtCache: GetSetState<boolean>;
    useOnnxShouldTensorRtFp16: GetSetState<boolean>;
    useIsSystemPython: GetSetState<boolean>;
    useSystemPythonLocation: GetSetState<string | null>;
    useCheckUpdOnStrtUp: GetSetState<boolean>;
    useSnapToGrid: readonly [
        snapToGrid: boolean,
        setSnapToGrid: SetState<boolean>,
        snapToGridAmount: number,
        setSnapToGridAmount: SetState<number>
    ];
    useStartupTemplate: GetSetState<string>;
    useIsDarkMode: GetSetState<boolean>;
    useAnimateChain: GetSetState<boolean>;
    useExperimentalFeatures: GetSetState<boolean>;
    useViewportExportPadding: GetSetState<number>;

    // Node Settings
    useNodeFavorites: GetSetState<readonly SchemaId[]>;
    useNodeSelectorCollapsed: GetSetState<boolean>;
}

// TODO: create context requires default values
export const SettingsContext = createContext<Readonly<Settings>>({} as Settings);

export const SettingsProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    // Global Settings
    const useIsCpu = useMemoArray(useLocalStorage('is-cpu', false));
    const useIsFp16 = useMemoArray(useLocalStorage('is-fp16', false));
    const usePyTorchGPU = useMemoArray(useLocalStorage('pytorch-gpu', 0));
    const useNcnnGPU = useMemoArray(useLocalStorage('ncnn-gpu', 0));
    const useOnnxGPU = useMemoArray(useLocalStorage('onnx-gpu', 0));
    const useOnnxExecutionProvider = useMemoArray(
        useLocalStorage('onnx-execution-provider', 'CUDAExecutionProvider')
    );
    const useOnnxShouldTensorRtCache = useMemoArray(
        useLocalStorage('onnx-should-tensorrt-cache', false)
    );
    const useOnnxShouldTensorRtFp16 = useMemoArray(
        useLocalStorage('onnx-should-tensorrt-fp16', false)
    );

    const useIsSystemPython = useMemoArray(useLocalStorage('use-system-python', false));
    const useSystemPythonLocation = useMemoArray(
        useLocalStorage<string | null>('system-python-location', null)
    );
    const useCheckUpdOnStrtUp = useMemoArray(useLocalStorage('check-upd-on-strtup', true));
    const useStartupTemplate = useMemoArray(useLocalStorage('startup-template', ''));

    const useIsDarkMode = useMemoArray(useLocalStorage('use-dark-mode', true));

    const { setColorMode } = useColorMode();
    const [isDarkMode] = useIsDarkMode;
    useEffect(() => {
        setColorMode(isDarkMode ? 'dark' : 'light');
    }, [setColorMode, isDarkMode]);

    const useAnimateChain = useMemoArray(useLocalStorage('animate-chain', true));

    // Snap to grid
    const [isSnapToGrid, setIsSnapToGrid] = useLocalStorage('snap-to-grid', false);
    const [snapToGridAmount, setSnapToGridAmount] = useLocalStorage('snap-to-grid-amount', 16);
    const useSnapToGrid = useMemoArray([
        isSnapToGrid,
        setIsSnapToGrid,
        snapToGridAmount || 1,
        setSnapToGridAmount,
    ] as const);

    const useViewportExportPadding = useMemoArray(useLocalStorage('viewport-export-padding', 20));

    // Node Settings
    const useNodeFavorites = useMemoArray(
        useLocalStorage<readonly SchemaId[]>('node-favorites', [])
    );
    const useNodeSelectorCollapsed = useMemoArray(
        useLocalStorage('node-selector-collapsed', false)
    );

    const useExperimentalFeatures = useMemoArray(useLocalStorage('experimental-features', false));

    const contextValue = useMemoObject<Settings>({
        // GPU Stuff
        useIsCpu,
        useIsFp16,
        usePyTorchGPU,
        useNcnnGPU,
        useOnnxGPU,
        useOnnxExecutionProvider,
        useOnnxShouldTensorRtCache,
        useOnnxShouldTensorRtFp16,

        // Globals
        useIsSystemPython,
        useSystemPythonLocation,
        useSnapToGrid,
        useCheckUpdOnStrtUp,
        useStartupTemplate,
        useIsDarkMode,
        useAnimateChain,
        useExperimentalFeatures,
        useViewportExportPadding,

        // Node
        useNodeFavorites,
        useNodeSelectorCollapsed,
    });

    return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
});
