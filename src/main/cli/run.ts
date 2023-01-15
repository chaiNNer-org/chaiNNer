import { app } from 'electron';
import log from 'electron-log';
import { Backend, BackendExecutionOptions, getBackend } from '../../common/Backend';
import { EdgeData, NodeData, NodeSchema } from '../../common/common-types';
import { getOnnxTensorRtCacheLocation } from '../../common/env';
import { checkNodeValidity } from '../../common/nodes/checkNodeValidity';
import { getConnectedInputs } from '../../common/nodes/connectedInputs';
import { getEffectivelyDisabledNodes } from '../../common/nodes/disabled';
import { parseFunctionDefinitions } from '../../common/nodes/parseFunctionDefinitions';
import { getNodesWithSideEffects } from '../../common/nodes/sideEffect';
import { toBackendJson } from '../../common/nodes/toBackendJson';
import { TypeState } from '../../common/nodes/TypeState';
import { SaveFile } from '../../common/SaveFile';
import { SchemaMap } from '../../common/SchemaMap';
import { ProgressController, ProgressMonitor, ProgressToken } from '../../common/ui/progress';
import { assertNever, delay } from '../../common/util';
import { RunArguments } from '../arguments';
import { setupBackend } from '../backend/setup';
import { getNvidiaGpuNames, getNvidiaSmi } from '../nvidiaSmi';
import { getRootDir } from '../platform';
import { settingStorage } from '../setting-storage';
import type { Edge, Node } from 'reactflow';

const addProgressListeners = (monitor: ProgressMonitor) => {
    monitor.addInterruptListener(({ type, title, message, options }) => {
        const logger = (s: string) => {
            if (type === 'warning') {
                log.warn(s);
            } else {
                log.error(s);
            }
        };

        if (title) logger(title);
        logger(message);

        for (const option of options ?? []) {
            logger(` - ${option.title}`);

            const { action } = option;
            switch (action.type) {
                case 'open-url':
                    logger(`   Go to ${action.url}`);
                    break;

                default:
                    return assertNever(action.type);
            }
        }

        if (type === 'critical error') {
            app.exit(1);
        }

        return Promise.resolve();
    });
};

const getNvidiaGPUs = async () => {
    const nvidiaSmi = await getNvidiaSmi();

    if (nvidiaSmi) {
        try {
            return await getNvidiaGpuNames(nvidiaSmi);
        } catch (error) {
            log.error(error);
        }
    }
    return undefined;
};

const createBackend = async (token: ProgressToken, args: RunArguments) => {
    const useSystemPython = settingStorage.getItem('use-system-python') === 'true';
    const systemPythonLocation = settingStorage.getItem('system-python-location');

    const hasNvidia = getNvidiaGPUs().then((gpus) => gpus !== undefined);
    const getRootDirPromise = getRootDir();

    return setupBackend(
        token,
        useSystemPython,
        systemPythonLocation,
        () => hasNvidia,
        () => getRootDirPromise,
        args.noBackend
    );
};

const getBackendNodes = async (backend: Backend): Promise<NodeSchema[]> => {
    // this implements an exponential back off strategy to
    const maxTries = 50;
    const startSleep = 1;
    const maxSleep = 250;

    for (let i = 0; i < maxTries; i += 1) {
        try {
            // eslint-disable-next-line no-await-in-loop
            return (await backend.nodes()).nodes;
        } catch {
            // eslint-disable-next-line no-await-in-loop
            await delay(Math.max(maxSleep, startSleep * 2 ** i));
        }
    }

    throw new Error('Unable to connect to backend server');
};

const getExecutionOptions = (): BackendExecutionOptions => {
    const getSetting = <T>(key: string, defaultValue: T): T => {
        const value = settingStorage.getItem(key);
        if (!value) return defaultValue;
        return JSON.parse(value) as T;
    };

    return {
        isCpu: getSetting('is-cpu', false),
        isFp16: getSetting('is-fp16', false),
        pytorchGPU: getSetting('pytorch-gpu', 0),
        ncnnGPU: getSetting('ncnn-gpu', 0),
        onnxGPU: getSetting('onnx-gpu', 0),
        onnxExecutionProvider: getSetting('onnx-execution-provider', 'CUDAExecutionProvider'),
        onnxShouldTensorRtCache: getSetting('onnx-should-tensorrt-cache', false),
        onnxTensorRtCachePath: getOnnxTensorRtCacheLocation(app.getPath('userData')),
    };
};

interface Chain {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
}

const ensureStaticCorrectness = ({ nodes, edges }: Readonly<Chain>, schemata: SchemaMap): void => {
    const functionDefinitions = parseFunctionDefinitions(schemata.schemata);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const typeState = TypeState.create(byId, edges, new Map(), functionDefinitions);

    const invalidNodes = nodes.flatMap((node) => {
        const functionInstance = typeState.functions.get(node.data.id);
        const schema = schemata.get(node.data.schemaId);
        const { category, name } = schema;
        const validity = checkNodeValidity({
            inputData: node.data.inputData,
            connectedInputs: getConnectedInputs(node.id, edges),
            schema,
            functionInstance,
        });
        if (validity.isValid) return [];

        return [`- ${category}: ${name}: ${validity.reason}`];
    });

    if (invalidNodes.length > 0) {
        const reasons = invalidNodes.join('\n');
        throw new Error(
            `There are invalid nodes in the editor. Please fix them before running.\n${reasons}`
        );
    }
};

export const runChainInCli = async (args: RunArguments) => {
    const progressController = new ProgressController();
    addProgressListeners(progressController);

    const backendProcess = await createBackend(progressController, args);
    if (backendProcess.owned) {
        backendProcess.addErrorListener((error) => {
            log.error(
                `The Python backend encountered an unexpected error. ChaiNNer will now exit. Error: ${String(
                    error
                )}`
            );
            app.exit(1);
        });
    }

    const backend = getBackend(backendProcess.port);

    const saveFile = await SaveFile.read(args.file);
    if (saveFile.tamperedWith) {
        log.warn(
            'The save file has been tampered with. This might lead to errors in the execution of this chain.'
        );
    }

    const schemata = new SchemaMap(await getBackendNodes(backend));
    const disabledNodes = new Set(
        getEffectivelyDisabledNodes(saveFile.nodes, saveFile.edges).map((n) => n.id)
    );
    const nodesToOptimize = saveFile.nodes.filter((n) => !disabledNodes.has(n.id));
    const nodes = getNodesWithSideEffects(nodesToOptimize, saveFile.edges, schemata);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = saveFile.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    // show an error if there are no nodes to run
    if (nodes.length === 0) {
        let message;
        if (nodesToOptimize.length > 0) {
            message = 'There are no nodes that have an effect. Try to view or output images/files.';
        } else if (disabledNodes.size > 0) {
            message = 'All nodes are disabled. There are no nodes to run.';
        } else {
            message = 'There are no nodes to run.';
        }
        log.error(message);
        return;
    }

    // check for static errors
    ensureStaticCorrectness({ nodes, edges }, schemata);

    const data = toBackendJson(nodes, edges, schemata);
    const options = getExecutionOptions();

    const response = await backend.run({
        data,
        options,
        sendBroadcastData: false,
    });

    if (response.type === 'error') {
        log.error(response.message);
        log.error(response.exception);
        if (response.source) {
            log.error(response.source);
        }
    }
    if (response.type === 'already-running') {
        log.error(`Cannot start because a previous executor is still running.`);
    }

    app.exit(response.type === 'success' ? 0 : 1);
};
