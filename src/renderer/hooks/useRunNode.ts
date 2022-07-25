import { useMemo, useRef } from 'react';
import { useContext } from 'use-context-selector';
import { getBackend } from '../../common/Backend';
import { NodeData } from '../../common/common-types';
import { delay } from '../../common/util';
import { AlertBoxContext } from '../contexts/AlertBoxContext';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { SettingsContext } from '../contexts/SettingsContext';
import { useAsyncEffect } from './useAsyncEffect';

export const useRunNode = ({ inputData, id, schemaId }: NodeData, shouldRun: boolean): void => {
    const { sendToast } = useContext(AlertBoxContext);
    const { changeNodes } = useContext(GlobalContext);
    const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);
    const backend = getBackend(port);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;

    const setAnimated = (nodeAnimated: boolean) => {
        changeNodes((nodes) =>
            nodes.map((n) => {
                if (n.id === id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            animated: nodeAnimated,
                        },
                    };
                }
                return n;
            })
        );
    };

    const inputHash = useMemo(() => JSON.stringify(Object.values(inputData)), [inputData]);
    const lastRunInputHash = useRef<string>();
    useAsyncEffect(
        async (token) => {
            if (shouldRun && inputHash !== lastRunInputHash.current) {
                // give it some time for other effects to settle in
                await delay(50);
                token.checkCanceled();

                lastRunInputHash.current = inputHash;
                setAnimated(true);

                const result = await backend.runIndividual({
                    schemaId,
                    id,
                    inputs: Object.values(inputData),
                    isCpu,
                    isFp16,
                });

                setAnimated(false);

                if (!result.success) {
                    sendToast({
                        status: 'error',
                        title: 'Error',
                        description: 'Image failed to load, probably unsupported file type.',
                    });
                }
            }
        },
        [shouldRun, inputHash]
    );
};
