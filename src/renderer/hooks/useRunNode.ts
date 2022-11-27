import log from 'electron-log';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { getOnnxTensorRtCacheLocation } from '../../common/env';
import { ipcRenderer } from '../../common/safeIpc';
import { delay, getInputValues } from '../../common/util';
import { AlertBoxContext } from '../contexts/AlertBoxContext';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { SettingsContext } from '../contexts/SettingsContext';
import { useAsyncEffect } from './useAsyncEffect';

/**
 * Runs the given node as soon as it should.
 *
 * Calling the returned function will try to re-run the node.
 */
export const useRunNode = (
    { inputData, id, schemaId }: NodeData,
    shouldRun: boolean
): (() => void) => {
    const { sendToast } = useContext(AlertBoxContext);
    const { animate, unAnimate } = useContext(GlobalContext);
    const { schemata, backend } = useContext(BackendContext);
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

    const [reloadCounter, setReloadCounter] = useState(0);
    const reload = useCallback(() => setReloadCounter((c) => c + 1), []);

    const schema = schemata.get(schemaId);

    const didEverRun = useRef(false);

    const inputs = useMemo(
        () => getInputValues(schema, (inputId) => inputData[inputId] ?? null),
        [inputData, schema]
    );
    const inputHash = useMemo(
        () => `${reloadCounter};${JSON.stringify(inputs)}`,
        [reloadCounter, inputs]
    );
    const lastInputHash = useRef<string>();
    useAsyncEffect(
        () => async (token) => {
            if (inputHash === lastInputHash.current) {
                return;
            }
            // give it some time for other effects to settle in
            await delay(50);
            token.checkCanceled();

            lastInputHash.current = inputHash;

            if (shouldRun) {
                didEverRun.current = true;
                animate([id], false);

                const result = await backend.runIndividual({
                    schemaId,
                    id,
                    inputs,
                    isCpu,
                    isFp16,
                    pytorchGPU,
                    ncnnGPU,
                    onnxGPU,
                    onnxExecutionProvider,
                    onnxShouldTensorRtCache,
                    onnxTensorRtCachePath: getOnnxTensorRtCacheLocation(
                        await ipcRenderer.invoke('get-appdata')
                    ),
                });

                if (!result.success) {
                    unAnimate([id]);
                    sendToast({
                        status: 'error',
                        title: 'Error',
                        description:
                            result.error ||
                            'Preview failed to load, probably unsupported file type.',
                    });
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [shouldRun, inputHash]
    );

    useEffect(() => {
        return () => {
            if (didEverRun.current) {
                backend.clearNodeCacheIndividual(id).catch((error) => log.error(error));
            }
        };
    }, [backend, id]);

    return reload;
};
