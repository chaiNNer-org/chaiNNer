import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContext } from 'use-context-selector';
import { NodeData } from '../../common/common-types';
import { log } from '../../common/log';
import { delay, mapInputValues } from '../../common/util';
import { AlertBoxContext } from '../contexts/AlertBoxContext';
import { BackendContext } from '../contexts/BackendContext';
import { GlobalContext } from '../contexts/GlobalNodeState';
import { useAsyncEffect } from './useAsyncEffect';
import { useAutomaticFeatures } from './useAutomaticFeatures';
import { useSettings } from './useSettings';

/**
 * Runs the given node as soon as it should.
 *
 * Calling the returned function will try to re-run the node.
 */
export const useRunNode = (
    { inputData, id, schemaId }: NodeData,
    isValid: boolean
): { reload: () => void; isLive: boolean } => {
    const { sendToast } = useContext(AlertBoxContext);
    const { addIndividuallyRunning, removeIndividuallyRunning } = useContext(GlobalContext);
    const { schemata, backend } = useContext(BackendContext);
    const { packageSettings } = useSettings();

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

    const { isAutomatic, hasIncomingConnections } = useAutomaticFeatures(id, schemaId);
    const shouldRun = isValid && isAutomatic;

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

                addIndividuallyRunning(id);
                const result = await backend.runIndividual({
                    schemaId,
                    id,
                    inputs,
                    options: packageSettings,
                });
                removeIndividuallyRunning(id);

                if (!result.success) {
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
                backend.clearNodeCacheIndividual(id).catch(log.error);
            }
        };
    }, [backend, id]);

    useEffect(() => {
        if (hasIncomingConnections && didEverRun.current) {
            backend.clearNodeCacheIndividual(id).catch(log.error);
        }
    }, [backend, hasIncomingConnections, id]);

    return { reload, isLive: shouldRun };
};
