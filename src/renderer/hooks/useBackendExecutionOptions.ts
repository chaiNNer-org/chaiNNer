import log from 'electron-log';
import { useEffect, useState } from 'react';
import { useContext } from 'use-context-selector';
import { BackendExecutionOptions } from '../../common/Backend';
import { getOnnxTensorRtCacheLocation } from '../../common/env';
import { ipcRenderer } from '../../common/safeIpc';
import { SettingsContext } from '../contexts/SettingsContext';

export const useBackendExecutionOptions = (): BackendExecutionOptions => {
    const {
        useIsCpu,
        useIsFp16,
        usePyTorchGPU,
        useNcnnGPU,
        useOnnxGPU,
        useOnnxExecutionProvider,
        useOnnxShouldTensorRtCache,
    } = useContext(SettingsContext);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;
    const [pytorchGPU] = usePyTorchGPU;
    const [ncnnGPU] = useNcnnGPU;
    const [onnxGPU] = useOnnxGPU;
    const [onnxExecutionProvider] = useOnnxExecutionProvider;
    const [onnxShouldTensorRtCache] = useOnnxShouldTensorRtCache;

    const [onnxTensorRtCachePath, setOnnxTensorRtCachePath] = useState('');
    useEffect(() => {
        ipcRenderer.invoke('get-appdata').then(
            (appData) => {
                setOnnxTensorRtCachePath(getOnnxTensorRtCacheLocation(appData));
            },
            (reason) => log.error(reason)
        );
    }, []);

    return {
        isCpu,
        isFp16,
        pytorchGPU,
        ncnnGPU,
        onnxGPU,
        onnxExecutionProvider,
        onnxShouldTensorRtCache,
        onnxTensorRtCachePath,
    };
};
