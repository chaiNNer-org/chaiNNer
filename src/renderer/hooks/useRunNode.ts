import { useEffect, useMemo, useRef, useState } from 'react';
import { useContext } from 'use-context-selector';
import { getBackend } from '../../common/Backend';
import { InputData, NodeData } from '../../common/common-types';
import { delay, getInputValues } from '../../common/util';
import { AlertBoxContext } from '../contexts/AlertBoxContext';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { SettingsContext } from '../contexts/SettingsContext';
import { useAsyncEffect } from './useAsyncEffect';

interface PreviousInputData {
    previous: InputData;
    current: InputData;
}

export const useRunNode = ({ inputData, id, schemaId }: NodeData, shouldRun: boolean): void => {
    const { sendToast } = useContext(AlertBoxContext);
    const { animate, unAnimate, schemata, resetNodeInputData } = useContext(GlobalContext);
    const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);
    const backend = getBackend(port);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;

    const schema = schemata.get(schemaId);

    const inputs = useMemo(
        () => getInputValues(schema, (inputId) => inputData[inputId] ?? null),
        [inputData]
    );
    const inputHash = useMemo(() => JSON.stringify(inputs), [inputData]);
    const lastRunInputHash = useRef<string>();

    const [previousInputData, setPreviousInputData] = useState<PreviousInputData>({
        previous: {},
        current: {},
    });

    useEffect(() => {
        setPreviousInputData({
            previous: previousInputData.current,
            current: inputData,
        });
    }, [inputs]);

    useAsyncEffect(
        async (token) => {
            if (shouldRun && inputHash !== lastRunInputHash.current) {
                // give it some time for other effects to settle in
                await delay(50);
                token.checkCanceled();

                lastRunInputHash.current = inputHash;
                animate([id], false);

                const result = await backend.runIndividual({ schemaId, id, inputs, isCpu, isFp16 });

                if (!result.success) {
                    resetNodeInputData(id, previousInputData.previous);
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
        [shouldRun, inputHash, previousInputData]
    );
};
