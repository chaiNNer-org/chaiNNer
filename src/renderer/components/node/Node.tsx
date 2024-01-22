import { Center, VStack } from '@chakra-ui/react';
import path from 'path';
import { DragEvent, memo, useMemo, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { Input, NodeData, runnableNodeTypes } from '../../../common/common-types';
import { DisabledStatus } from '../../../common/nodes/disabled';
import {
    EMPTY_ARRAY,
    getInputValue,
    isStartingNode,
    parseSourceHandle,
} from '../../../common/util';
import { AlertBoxContext } from '../../contexts/AlertBoxContext';
import { BackendContext } from '../../contexts/BackendContext';
import { ExecutionContext, NodeExecutionStatus } from '../../contexts/ExecutionContext';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getCategoryAccentColor, getTypeAccentColors } from '../../helpers/accentColors';
import { shadeColor } from '../../helpers/colorTools';
import { getSingleFileWithExtension } from '../../helpers/dataTransfer';
import { useNodeStateFromData } from '../../helpers/nodeState';
import { useDisabled } from '../../hooks/useDisabled';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { useRunNode } from '../../hooks/useRunNode';
import { useValidity } from '../../hooks/useValidity';
import { useWatchFiles } from '../../hooks/useWatchFiles';
import { NodeBody } from './NodeBody';
import { NodeFooter } from './NodeFooter/NodeFooter';
import { NodeHeader } from './NodeHeader';
import { NoteNode } from './special/NoteNode';

/**
 * If there is only one file input, then this input will be returned. `undefined` otherwise.
 */
const getSingleFileInput = (inputs: readonly Input[]): Input | undefined => {
    const fileInputs = inputs.filter((i) => {
        switch (i.kind) {
            case 'file':
                return true;
            default:
                return false;
        }
    });

    return fileInputs.length === 1 ? fileInputs[0] : undefined;
};

export const Node = memo(({ data, selected }: NodeProps) => {
    if (data.schemaId === 'chainner:utility:note') {
        return (
            <NoteNode
                data={data}
                selected={selected}
            />
        );
    }

    return (
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        <NodeInner
            data={data}
            selected={selected}
        />
    );
});

export interface NodeProps {
    data: NodeData;
    selected: boolean;
}

const NodeInner = memo(({ data, selected }: NodeProps) => {
    const nodeState = useNodeStateFromData(data);
    const { schema, setInputValue } = nodeState;

    const { sendToast } = useContext(AlertBoxContext);
    const { categories } = useContext(BackendContext);
    const { getNodeProgress, getNodeStatus } = useContext(ExecutionContext);

    const { id, inputData } = data;
    const nodeProgress = getNodeProgress(id);

    const individuallyRunning = useContextSelector(GlobalVolatileContext, (c) =>
        c.isIndividuallyRunning(id)
    );
    const executionStatus = getNodeStatus(id);
    const animated =
        executionStatus === NodeExecutionStatus.RUNNING ||
        executionStatus === NodeExecutionStatus.YET_TO_RUN ||
        individuallyRunning;

    const { getEdge } = useReactFlow();

    // We get inputs and outputs this way in case something changes with them in the future
    // This way, we have to do less in the migration file
    const { inputs, category } = schema;

    const { validity } = useValidity(id, schema, inputData);

    const regularBorderColor = 'var(--node-border-color)';
    const accentColor = getCategoryAccentColor(categories, category);
    const borderColor = useMemo(
        () => (selected ? shadeColor(accentColor, 0) : regularBorderColor),
        [selected, accentColor, regularBorderColor]
    );

    const targetRef = useRef<HTMLDivElement>(null);

    const collidingAccentColor = useContextSelector(
        GlobalVolatileContext,
        ({ collidingEdge, collidingNode, typeState }) => {
            if (collidingNode && collidingNode === id && collidingEdge) {
                const collidingEdgeActual = getEdge(collidingEdge);
                if (collidingEdgeActual && collidingEdgeActual.sourceHandle) {
                    const edgeType = typeState.functions
                        .get(collidingEdgeActual.source)
                        ?.outputs.get(parseSourceHandle(collidingEdgeActual.sourceHandle).outputId);
                    if (edgeType) {
                        return getTypeAccentColors(edgeType)[0];
                    }
                }
            }
            return undefined;
        }
    );

    const fileInput = useMemo(() => getSingleFileInput(inputs), [inputs]);

    const onDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (fileInput && fileInput.kind === 'file' && event.dataTransfer.types.includes('Files')) {
            event.stopPropagation();

            // eslint-disable-next-line no-param-reassign
            event.dataTransfer.dropEffect = 'move';
        }
    };

    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (fileInput && fileInput.kind === 'file' && event.dataTransfer.types.includes('Files')) {
            event.stopPropagation();

            const p = getSingleFileWithExtension(event.dataTransfer, fileInput.filetypes);
            if (p) {
                setInputValue(fileInput.id, p);
                return;
            }

            if (event.dataTransfer.files.length !== 1) {
                sendToast({
                    status: 'error',
                    description: `Only one file is accepted by ${fileInput.label}.`,
                });
            } else {
                const ext = path.extname(event.dataTransfer.files[0].path);
                sendToast({
                    status: 'error',
                    description: `${fileInput.label} does not accept ${ext} files.`,
                });
            }
        }
    };

    const startingNode = isStartingNode(schema);
    const isNewIterator = schema.kind === 'newIterator';
    const hasStaticValueInput = schema.inputs.some((i) => i.kind === 'static');
    const isRunnable = runnableNodeTypes.includes(schema.kind);
    const reload = useRunNode(
        data,
        validity.isValid && startingNode && !isNewIterator && !hasStaticValueInput && isRunnable
    );
    const filesToWatch = useMemo(() => {
        if (!startingNode) return EMPTY_ARRAY;

        const files: string[] = [];
        for (const input of schema.inputs) {
            if (input.kind === 'file') {
                const value = getInputValue<string>(input.id, data.inputData);
                if (value) {
                    files.push(value);
                }
            }
        }

        if (files.length === 0) return EMPTY_ARRAY;
        return files;
    }, [startingNode, data.inputData, schema]);
    useWatchFiles(filesToWatch, reload);

    const disabled = useDisabled(data);
    const menu = useNodeMenu(data, disabled, { reload: startingNode ? reload : undefined });

    return (
        <Center
            bg="var(--node-bg-color)"
            borderColor={collidingAccentColor || borderColor}
            borderRadius="lg"
            borderWidth="0.5px"
            boxShadow="lg"
            minWidth="240px"
            opacity={disabled.status === DisabledStatus.Enabled ? 1 : 0.75}
            overflow="hidden"
            ref={targetRef}
            transition="0.15s ease-in-out"
            onContextMenu={menu.onContextMenu}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <VStack
                opacity={disabled.status === DisabledStatus.Enabled ? 1 : 0.75}
                spacing={0}
                w="full"
            >
                <VStack
                    spacing={0}
                    w="full"
                >
                    <NodeHeader
                        accentColor={accentColor}
                        disabledStatus={disabled.status}
                        icon={schema.icon}
                        name={schema.name}
                        nodeProgress={nodeProgress}
                        selected={selected}
                    />
                    <NodeBody
                        animated={animated}
                        nodeState={nodeState}
                    />
                </VStack>
                <NodeFooter
                    animated={animated}
                    id={id}
                    useDisable={disabled}
                    validity={validity}
                />
            </VStack>
        </Center>
    );
});
