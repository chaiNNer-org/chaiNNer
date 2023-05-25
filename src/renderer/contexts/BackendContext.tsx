import { Scope } from '@chainner/navi';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { createContext } from 'use-context-selector';
import { Backend, getBackend } from '../../common/Backend';
import { Category, PythonInfo, SchemaId } from '../../common/common-types';
import { ipcRenderer } from '../../common/safeIpc';
import { SchemaInputsMap } from '../../common/SchemaInputsMap';
import { SchemaMap } from '../../common/SchemaMap';
import { getChainnerScope } from '../../common/types/chainner-scope';
import { FunctionDefinition } from '../../common/types/function';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import { useMemoObject } from '../hooks/useMemo';

interface BackendContextState {
    port: number;
    backend: Backend;
    ownsBackend: boolean;
    schemata: SchemaMap;
    schemaInputs: SchemaInputsMap;
    pythonInfo: PythonInfo;
    /**
     * An ordered list of all categories supported by the backend.
     *
     * Some categories might be empty.
     */
    categories: Category[];
    categoriesMissingNodes: string[];
    functionDefinitions: Map<SchemaId, FunctionDefinition>;
    scope: Scope;
    restartingRef: Readonly<React.MutableRefObject<boolean>>;
    restart: () => Promise<void>;
}

export const BackendContext = createContext<Readonly<BackendContextState>>(
    {} as BackendContextState
);

interface BackendProviderProps {
    port: number;
    schemata: SchemaMap;
    pythonInfo: PythonInfo;
    categories: Category[];
    categoriesMissingNodes: string[];
    functionDefinitions: Map<SchemaId, FunctionDefinition>;
    refreshNodes: () => void;
}

export const BackendProvider = memo(
    ({
        port,
        schemata,
        pythonInfo,
        categories,
        categoriesMissingNodes,
        functionDefinitions,
        refreshNodes,
        children,
    }: React.PropsWithChildren<BackendProviderProps>) => {
        const backend = getBackend(port);

        const [ownsBackend, setOwnsBackend] = useState<boolean>(false);
        const ownsBackendRef = useRef(ownsBackend);
        useAsyncEffect(
            () => ({
                supplier: () => ipcRenderer.invoke('owns-backend'),
                successEffect: (value) => {
                    setOwnsBackend(value);
                    ownsBackendRef.current = value;
                },
            }),
            []
        );

        const scope = useMemo(() => {
            // function definitions all use the same scope, so just pick any one of them
            return [...functionDefinitions.values()][0]?.scope ?? getChainnerScope();
        }, [functionDefinitions]);
        const schemaInputs = useMemo(() => new SchemaInputsMap(schemata.schemata), [schemata]);

        const restartingRef = useRef(false);
        const restartPromiseRef = useRef<Promise<void>>();
        const needsNewRestartRef = useRef(false);
        const restart = useCallback((): Promise<void> => {
            if (!ownsBackendRef.current) {
                // we don't own the backend, so we can't restart it
                return Promise.resolve();
            }

            if (restartPromiseRef.current) {
                // another promise is currently restarting the backend, so we just request another restart
                needsNewRestartRef.current = true;
                return restartPromiseRef.current;
            }

            restartingRef.current = true;
            restartPromiseRef.current = (async () => {
                let error;
                do {
                    needsNewRestartRef.current = false;
                    try {
                        backend.abort();
                        // eslint-disable-next-line no-await-in-loop
                        await ipcRenderer.invoke('restart-backend');
                        error = null;
                    } catch (e) {
                        error = e;
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                } while (needsNewRestartRef.current);

                // Done. At this point, the backend either restarted or failed trying
                restartingRef.current = false;
                restartPromiseRef.current = undefined;
                refreshNodes();

                if (error != null) {
                    throw error instanceof Error ? error : new Error(error);
                }
            })();
            return restartPromiseRef.current;
        }, [backend, refreshNodes]);

        const value = useMemoObject<BackendContextState>({
            port,
            backend,
            ownsBackend,
            schemata,
            schemaInputs,
            pythonInfo,
            categories,
            categoriesMissingNodes,
            functionDefinitions,
            scope,
            restartingRef,
            restart,
        });

        return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
    }
);
