import log from 'electron-log';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { delay, mapInputValues } from '../../common/util';
import { AlertBoxContext } from '../contexts/AlertBoxContext';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { useAsyncEffect } from './useAsyncEffect';
import { useBackendExecutionOptions } from './useBackendExecutionOptions';

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

    const options = useBackendExecutionOptions();

    const [reloadCounter, setReloadCounter] = useState(0);
    const reload = useCallback(() => setReloadCounter((c) => c + 1), []);

    const schema = schemata.get(schemaId);

    const didEverRun = useRef(false);

    const inputs = useMemo(
        () => mapInputValues(schema, (inputId) => inputData[inputId] ?? null),
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
                    options,
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
