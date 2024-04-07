import { Center, VStack } from '@chakra-ui/react';
import path from 'path';
import {
    DragEvent,
    DragEventHandler,
    LegacyRef,
    MouseEventHandler,
    memo,
    useCallback,
    useMemo,
    useRef,
} from 'react';
import { useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { Input, NodeData } from '../../../common/common-types';
import { DisabledStatus } from '../../../common/nodes/disabled';
import {
    EMPTY_ARRAY,
    getInputValue,
    isStartingNode,
    parseSourceHandle,
} from '../../../common/util';
import { Validity } from '../../../common/Validity';
import { AlertBoxContext } from '../../contexts/AlertBoxContext';
import { BackendContext } from '../../contexts/BackendContext';
import {
    ExecutionContext,
    NodeExecutionStatus,
    NodeProgress,
} from '../../contexts/ExecutionContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getCategoryAccentColor, getTypeAccentColors } from '../../helpers/accentColors';
import { shadeColor } from '../../helpers/colorTools';
import { getSingleFileWithExtension } from '../../helpers/dataTransfer';
import { NodeState, useNodeStateFromData } from '../../helpers/nodeState';
import { UseDisabled, useDisabled } from '../../hooks/useDisabled';
import { useNodeMenu } from '../../hooks/useNodeMenu';
import { useRunNode } from '../../hooks/useRunNode';
import { useValidity } from '../../hooks/useValidity';
import { useWatchFiles } from '../../hooks/useWatchFiles';
import { CollapsedHandles } from './CollapsedHandles';
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

export interface NodeViewProps {
    nodeState: NodeState;
    validity: Validity;
    selected?: boolean;
    animated?: boolean;
    isCollapsed?: boolean;
    toggleCollapse?: () => void;
    disable?: UseDisabled;
    nodeProgress?: NodeProgress;
    borderColor?: string;

    targetRef?: LegacyRef<HTMLDivElement>;
    onContextMenu?: MouseEventHandler<HTMLDivElement>;
    onDragOver?: DragEventHandler<HTMLDivElement>;
    onDrop?: DragEventHandler<HTMLDivElement>;
}

export const NodeView = memo(
    ({
        nodeState,
        validity,
        selected = false,
        animated = false,
        isCollapsed = false,
        toggleCollapse,
        disable,
        nodeProgress,
        borderColor,
        targetRef,
        onContextMenu,
        onDragOver,
        onDrop,
    }: NodeViewProps) => {
        const { categories } = useContext(BackendContext);

        const { id, schema } = nodeState;

        const bgColor = 'var(--node-bg-color)';
        const accentColor = getCategoryAccentColor(categories, schema.category);
        const finalBorderColor = useMemo(() => {
            if (borderColor) return borderColor;
            const regularBorderColor = 'var(--node-border-color)';
            return selected ? shadeColor(accentColor, 0) : regularBorderColor;
        }, [selected, accentColor, borderColor]);

        const isEnabled = disable === undefined || disable.status === DisabledStatus.Enabled;

        return (
            <Center
                bg={selected && isCollapsed ? accentColor : bgColor}
                borderColor={finalBorderColor}
                borderRadius="lg"
                borderWidth="0.5px"
                boxShadow="lg"
                minWidth="240px"
                opacity={isEnabled ? 1 : 0.75}
                overflow="hidden"
                ref={targetRef}
                transition="0.15s ease-in-out"
                transitionProperty="border-color, opacity"
                onContextMenu={onContextMenu}
                onDragOver={onDragOver}
                onDrop={onDrop}
            >
                <VStack
                    opacity={isEnabled ? 1 : 0.75}
                    spacing={0}
                    w="full"
                >
                    <VStack
                        spacing={0}
                        w="full"
                    >
                        <NodeHeader
                            accentColor={accentColor}
                            animated={animated}
                            isCollapsed={isCollapsed}
                            isEnabled={isEnabled}
                            nodeProgress={nodeProgress}
                            nodeState={nodeState}
                            selected={selected}
                            toggleCollapse={toggleCollapse}
                            validity={validity}
                        />
                        {!isCollapsed ? (
                            <NodeBody
                                animated={animated}
                                nodeState={nodeState}
                            />
                        ) : (
                            <CollapsedHandles nodeState={nodeState} />
                        )}
                    </VStack>
                    {!isCollapsed && (
                        <NodeFooter
                            animated={animated}
                            disable={disable}
                            id={id}
                            validity={validity}
                        />
                    )}
                </VStack>
            </Center>
        );
    }
);

const NodeInner = memo(({ data, selected }: NodeProps) => {
    const nodeState = useNodeStateFromData(data);
    const { schema, setInputValue } = nodeState;

    const { sendToast } = useContext(AlertBoxContext);
    const { setNodeCollapsed } = useContext(GlobalContext);
    const { getNodeProgress, getNodeStatus } = useContext(ExecutionContext);

    const { id, inputData, isCollapsed = false } = data;
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
    const { inputs } = schema;

    const { validity } = useValidity(id, schema, inputData);

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
    const reload = useRunNode(
        data,
        validity.isValid && startingNode && !isNewIterator && !hasStaticValueInput
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
    const menu = useNodeMenu(data, disabled, {
        reload: startingNode ? reload : undefined,
    });

    const toggleCollapse = useCallback(() => {
        setNodeCollapsed(id, !isCollapsed);
    }, [id, isCollapsed, setNodeCollapsed]);

    return (
        <NodeView
            animated={animated}
            borderColor={collidingAccentColor}
            disable={disabled}
            isCollapsed={isCollapsed}
            nodeProgress={nodeProgress}
            nodeState={nodeState}
            selected={selected}
            targetRef={targetRef}
            toggleCollapse={toggleCollapse}
            validity={validity}
            onContextMenu={menu.onContextMenu}
            onDragOver={onDragOver}
            onDrop={onDrop}
        />
    );
});

export interface NodeProps {
    data: NodeData;
    selected: boolean;
}

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
        <NodeInner
            data={data}
            selected={selected}
        />
    );
});
