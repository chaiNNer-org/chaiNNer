import log from 'electron-log';
import { useEffect, useMemo, useRef } from 'react';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { delay, getInputValues, isStartingNode } from '../../common/util';
import { AlertBoxContext } from '../contexts/AlertBoxContext';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { SettingsContext } from '../contexts/SettingsContext';
import { useAsyncEffect } from './useAsyncEffect';

export const useRunNode = ({ inputData, id, schemaId }: NodeData, shouldRun: boolean): void => {
    const { sendToast } = useContext(AlertBoxContext);
    const { animate, unAnimate } = useContext(GlobalContext);
    const { schemata, backend } = useContext(BackendContext);
    const { useIsCpu, useIsFp16, usePyTorchGPU, useNcnnGPU } = useContext(SettingsContext);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;
    const [pytorchGPU] = usePyTorchGPU;
    const [ncnnGPU] = useNcnnGPU;

    const schema = schemata.get(schemaId);

    const inputs = useMemo(
        () => getInputValues(schema, (inputId) => inputData[inputId] ?? null),
        [inputData]
    );
    const inputHash = useMemo(() => JSON.stringify(inputs), [inputData]);
    const lastRunInputHash = useRef<string>();
    useAsyncEffect(
        async (token) => {
            if (shouldRun && inputHash !== lastRunInputHash.current) {
                // give it some time for other effects to settle in
                await delay(50);
                token.checkCanceled();

                lastRunInputHash.current = inputHash;
                animate([id], false);

                const result = await backend.runIndividual({
                    schemaId,
                    id,
                    inputs,
                    isCpu,
                    isFp16,
                    pytorchGPU,
                    ncnnGPU,
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
        [shouldRun, inputHash]
    );

    useEffect(() => {
        return () => {
            // TODO: Change this if we ever make more than starting nodes run
            if (isStartingNode(schema)) {
                backend
                    .clearNodeCacheIndividual(id)
                    .then(() => {})
                    .catch((error) => {
                        log.error(error);
                    });
            }
        };
    }, []);
};
