import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { createContext } from 'use-context-selector';
import { Backend, getBackend } from '../../common/Backend';
import { Category, PythonInfo, SchemaId } from '../../common/common-types';
import { ipcRenderer } from '../../common/safeIpc';
import { SchemaInputsMap } from '../../common/SchemaInputsMap';
import { SchemaMap } from '../../common/SchemaMap';
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
        useAsyncEffect(
            () => ({
                supplier: () => ipcRenderer.invoke('owns-backend'),
                successEffect: setOwnsBackend,
            }),
            []
        );

        const schemaInputs = useMemo(() => new SchemaInputsMap(schemata.schemata), [schemata]);

        const restartingRef = useRef(false);
        const restartPromiseRef = useRef<Promise<void>>();
        const needsNewRestartRef = useRef(false);
        const restart = useCallback((): Promise<void> => {
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

                if (error !== null) {
                    throw error;
                }
            })();
            return restartPromiseRef.current;
        }, [refreshNodes]);

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
            restartingRef,
            restart,
        });

        return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
    }
);
