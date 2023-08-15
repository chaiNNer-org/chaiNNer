import { useEffect, useState } from 'react';
import { useContext } from 'use-context-selector';
import { BackendExecutionOptions } from '../../common/Backend';
import { getOnnxTensorRtCacheLocation } from '../../common/env';
import { log } from '../../common/log';
import { ipcRenderer } from '../../common/safeIpc';
import { SettingsContext } from '../contexts/SettingsContext';

export const useBackendExecutionOptions = (): BackendExecutionOptions => {
    const {
        useIsCpu,
        useIsFp16,
        usePyTorchGPU,
        useNcnnGPU,
        useNcnnBudgetLimit,
        useOnnxGPU,
        useOnnxExecutionProvider,
        useOnnxShouldTensorRtCache,
        useOnnxShouldTensorRtFp16,
    } = useContext(SettingsContext);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;
    const [pytorchGPU] = usePyTorchGPU;
    const [ncnnGPU] = useNcnnGPU;
    const [ncnnBudgetLimit] = useNcnnBudgetLimit;
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

    const [onnxShouldTensorRtFp16] = useOnnxShouldTensorRtFp16;

    return {
        isCpu,
        isFp16,
        pytorchGPU,
        ncnnGPU,
        ncnnBudgetLimit,
        onnxGPU,
        onnxExecutionProvider,
        onnxShouldTensorRtCache,
        onnxTensorRtCachePath,
        onnxShouldTensorRtFp16,
    };
};
