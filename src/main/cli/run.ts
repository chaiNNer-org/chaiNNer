import { app } from 'electron/main';
import EventSource from 'eventsource';
import { Backend, BackendEventMap, getBackend } from '../../common/Backend';
import { EdgeData, NodeData, NodeSchema, SchemaId } from '../../common/common-types';
import { formatExecutionErrorMessage } from '../../common/formatExecutionErrorMessage';
import { applyOverrides, readOverrideFile } from '../../common/input-override';
import { log } from '../../common/log';
import { checkNodeValidity } from '../../common/nodes/checkNodeValidity';
import { getConnectedInputs } from '../../common/nodes/connectedInputs';
import { ChainLineage } from '../../common/nodes/lineage';
import { optimizeChain } from '../../common/nodes/optimize';
import { parseFunctionDefinitions } from '../../common/nodes/parseFunctionDefinitions';
import { toBackendJson } from '../../common/nodes/toBackendJson';
import { TypeState } from '../../common/nodes/TypeState';
import { PassthroughMap } from '../../common/PassthroughMap';
import { SaveFile } from '../../common/SaveFile';
import { SchemaMap } from '../../common/SchemaMap';
import { ChainnerSettings } from '../../common/settings/settings';
import { FunctionDefinition } from '../../common/types/function';
import { ProgressController, ProgressMonitor, ProgressToken } from '../../common/ui/progress';
import { assertNever, delay } from '../../common/util';
import { RunArguments } from '../arguments';
import { BackendProcess } from '../backend/process';
import { setupBackend } from '../backend/setup';
import { getRootDir } from '../platform';
import { readSettings } from '../setting-storage';
import { Exit } from './exit';
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

                case 'run':
                    // log nothing
                    break;

                default:
                    return assertNever(action);
            }
        }

        if (type === 'critical error') {
            app.exit(1);
        }

        return Promise.resolve();
    });
};

const createBackend = async (
    token: ProgressToken,
    args: RunArguments,
    settings: ChainnerSettings
) => {
    return setupBackend(
        token,
        settings.useSystemPython,
        settings.systemPythonLocation,
        getRootDir(),
        args.remoteBackend
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
            // ignore error
        }
        // eslint-disable-next-line no-await-in-loop
        await delay(Math.max(maxSleep, startSleep * 2 ** i));
    }

    throw new Error('Unable to connect to backend server');
};

interface ReadyBackend {
    backend: Backend;
    schemata: SchemaMap;
    functionDefinitions: Map<SchemaId, FunctionDefinition>;
    eventSource: EventSource;
}
const connectToBackend = async (backendProcess: BackendProcess): Promise<ReadyBackend> => {
    const backend = getBackend(backendProcess.url);

    const schemata = new SchemaMap(await getBackendNodes(backend));

    // only connect the event source after we first heard back from the backend
    const eventSource = new EventSource(`${backendProcess.url}/sse`, {
        withCredentials: true,
    });

    // this validates that the nodes on the backend "make sense"
    const functionDefinitions = parseFunctionDefinitions(schemata.schemata);

    return { backend, schemata, functionDefinitions, eventSource };
};

interface Chain {
    nodes: Node<NodeData>[];
    edges: Edge<EdgeData>[];
}

const ensureStaticCorrectness = (
    { nodes, edges }: Readonly<Chain>,
    schemata: SchemaMap,
    functionDefinitions: ReadonlyMap<SchemaId, FunctionDefinition>,
    passthrough: PassthroughMap
): void => {
    const unknown = nodes.filter((n) => !schemata.has(n.data.schemaId));
    if (unknown.length > 0) {
        log.error(
            `There are ${unknown.length} unknown node(s) in the chain.` +
                ` This means that either (1) the chain was produces by a newer version of chainner, (2) the node was deprecated and has been removed, or (3) a third-party plugin is not installed.`
        );
        throw new Exit(1);
    }

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const typeState = TypeState.create(byId, edges, new Map(), functionDefinitions, passthrough);
    const chainLineage = new ChainLineage(schemata, nodes, edges);

    const invalidNodes = nodes.flatMap((node) => {
        const functionInstance = typeState.functions.get(node.data.id);
        const schema = schemata.get(node.data.schemaId);
        const { category, name } = schema;
        const validity = checkNodeValidity({
            inputData: node.data.inputData,
            connectedInputs: getConnectedInputs(node.id, edges),
            schema,
            functionInstance,
            chainLineage,
            nodeId: node.id,
        });
        if (validity.isValid) return [];

        return [`- ${category}: ${name}: ${validity.reason}`];
    });

    if (invalidNodes.length > 0) {
        const reasons = invalidNodes.join('\n');
        log.error(
            `There are invalid nodes in the chain. Please fix them before running.\n${reasons}`
        );
        throw new Exit(1);
    }
};

const addEventListener = <K extends keyof BackendEventMap>(
    eventSource: EventSource,
    type: K,
    listener: (data: BackendEventMap[K]) => void
) => {
    eventSource.addEventListener(type, (event) => {
        const data = JSON.parse(event.data as string) as BackendEventMap[K];
        listener(data);
    });
};

export const runChainInCli = async (args: RunArguments) => {
    const progressController = new ProgressController();
    addProgressListeners(progressController);

    const settings = readSettings();

    const backendProcess = await createBackend(progressController, args, settings);
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

    const { backend, schemata, functionDefinitions, eventSource } = await connectToBackend(
        backendProcess
    );

    log.info(`Read chain file ${args.file}`);
    const saveFile = await SaveFile.read(args.file);
    if (saveFile.tamperedWith) {
        log.warn(
            `The save file has been tampered with. This might lead to errors in the execution of this chain.`
        );
    }

    if (args.overrideFile) {
        log.info(`Read override file ${args.overrideFile}`);
        const overrideFile = await readOverrideFile(args.overrideFile);
        applyOverrides(saveFile.nodes, saveFile.edges, schemata, overrideFile);
    }

    const passthrough = PassthroughMap.create(functionDefinitions);
    const { nodes, edges, report } = optimizeChain(
        saveFile.nodes,
        saveFile.edges,
        schemata,
        passthrough
    );

    // show an error if there are no nodes to run
    if (nodes.length === 0) {
        let message;
        if (report.removedSideEffectFree > 0) {
            message = 'There are no nodes that have an effect. Try to view or output images/files.';
        } else if (report.removedDisabled > 0) {
            message = 'All nodes are disabled. There are no nodes to run.';
        } else {
            message = 'There are no nodes to run.';
        }
        log.error(message);
        throw new Exit();
    }

    // check for static errors
    ensureStaticCorrectness({ nodes, edges }, schemata, functionDefinitions, passthrough);

    // progress
    const nodeIds = new Set(nodes.map((n) => n.id));
    const finishedFreeNodes = new Set<string>();
    addEventListener(eventSource, 'node-finish', ({ nodeId }) => {
        let didAdd = false;
        if (nodeIds.has(nodeId) && !finishedFreeNodes.has(nodeId)) {
            finishedFreeNodes.add(nodeId);
            didAdd = true;
        }
        if (didAdd) {
            log.info(`Executed ${finishedFreeNodes.size}/${nodeIds.size} nodes`);
        }
    });

    const data = toBackendJson(nodes, edges, schemata);
    const response = await backend.run({
        data,
        options: settings.packageSettings,
        sendBroadcastData: false,
    });
    eventSource.close();

    if (response.type === 'error') {
        log.error(response.message);
        log.error(formatExecutionErrorMessage(response, schemata));
        throw new Exit();
    }
    if (response.type === 'already-running') {
        log.error(`Cannot start because a previous executor is still running.`);
        throw new Exit();
    }

    log.info('Done.');
};
