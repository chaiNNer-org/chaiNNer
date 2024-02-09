import { NeverType } from '@chainner/navi';
import { Center, Icon, IconButton } from '@chakra-ui/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { TbUnlink } from 'react-icons/tb';
import { EdgeProps, getBezierPath, getStraightPath, useKeyPress, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { EdgeData, NodeData } from '../../../common/common-types';
import { assertNever, parseSourceHandle } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { ExecutionContext, NodeExecutionStatus } from '../../contexts/ExecutionContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { getTypeAccentColors } from '../../helpers/accentColors';
import { shadeColor } from '../../helpers/colorTools';
import { getCircularEdgeParams } from '../../helpers/floatingEdgeUtils';
import { getCustomBezierPath } from '../../helpers/graphUtils';
import { useEdgeMenu } from '../../hooks/useEdgeMenu';
import './CustomEdge.scss';

const EDGE_CLASS = {
    RUNNING: 'running',
    YET_TO_RUN: 'yet-to-run',
    HOVERED: 'hovered',
    COLLIDING: 'colliding',
    NONE: '',
};

const getHoveredClass = (isHovered: boolean) => {
    if (isHovered) {
        return EDGE_CLASS.HOVERED;
    }
    return EDGE_CLASS.NONE;
};

const getCollidingClass = (isColliding: boolean) => {
    if (isColliding) {
        return EDGE_CLASS.COLLIDING;
    }
    return EDGE_CLASS.NONE;
};

const getRunningStateClass = (
    sourceStatus: NodeExecutionStatus,
    targetStatus: NodeExecutionStatus,
    animateChain?: boolean
) => {
    if (targetStatus === NodeExecutionStatus.NOT_EXECUTING) {
        return EDGE_CLASS.NONE;
    }
    switch (sourceStatus) {
        case NodeExecutionStatus.NOT_EXECUTING:
        case NodeExecutionStatus.FINISHED:
            return EDGE_CLASS.NONE;
        case NodeExecutionStatus.RUNNING:
            return animateChain ? EDGE_CLASS.RUNNING : EDGE_CLASS.YET_TO_RUN;
        case NodeExecutionStatus.YET_TO_RUN:
            return EDGE_CLASS.YET_TO_RUN;
        default:
            return assertNever(sourceStatus);
    }
};

export const CustomEdge = memo(
    ({
        id,
        source,
        target,
        sourceX: _sourceX,
        sourceY,
        targetX: _targetX,
        targetY,
        sourcePosition,
        targetPosition,
        selected,
        sourceHandleId,
        data = {},
        style,
    }: EdgeProps<EdgeData>) => {
        const sourceX = _sourceX - 1; // - 8 <- To align it with the node
        const targetX = _targetX + 1; // + 8

        const { screenToFlowPosition } = useReactFlow();
        const effectivelyDisabledNodes = useContextSelector(
            GlobalVolatileContext,
            (c) => c.effectivelyDisabledNodes
        );
        const { paused, getNodeStatus } = useContext(ExecutionContext);
        const { useAnimateChain } = useContext(SettingsContext);
        const [animateChain] = useAnimateChain;

        const sourceStatus = getNodeStatus(source);
        const targetStatus = getNodeStatus(target);
        const animated =
            (sourceStatus === NodeExecutionStatus.RUNNING ||
                sourceStatus === NodeExecutionStatus.YET_TO_RUN) &&
            targetStatus !== NodeExecutionStatus.NOT_EXECUTING;

        const { getNode } = useReactFlow<NodeData, EdgeData>();
        const edgeParentNode = useMemo(() => getNode(source)!, [source, getNode]);
        const edgeChildNode = useMemo(() => getNode(target)!, [target, getNode]);

        const isAttachedToBreakPoint =
            edgeParentNode.type === 'breakPoint' || edgeChildNode.type === 'breakPoint';

        const [edgePath, edgeCenterX, edgeCenterY] = useMemo(() => {
            if (edgeParentNode.type !== 'breakPoint' && isAttachedToBreakPoint) {
                return getCustomBezierPath({
                    sourceX,
                    sourceY,
                    sourcePosition,
                    targetX,
                    targetY,
                    targetPosition,
                    curvatures: {
                        source: 0.25,
                        target: 0,
                    },
                    radii: {
                        source: 0,
                        target: 6,
                    },
                });
            }
            if (edgeChildNode.type !== 'breakPoint' && isAttachedToBreakPoint) {
                return getCustomBezierPath({
                    sourceX,
                    sourceY,
                    sourcePosition,
                    targetX,
                    targetY,
                    targetPosition,
                    curvatures: {
                        source: 0,
                        target: 0.25,
                    },
                    radii: {
                        source: 6,
                        target: 0,
                    },
                });
            }
            if (isAttachedToBreakPoint) {
                const { sx, sy, tx, ty } = getCircularEdgeParams(
                    {
                        x: _sourceX,
                        y: sourceY,
                        radius: 6,
                    },
                    {
                        x: _targetX,
                        y: targetY,
                        radius: 6,
                    }
                );

                return getStraightPath({
                    sourceX: sx,
                    sourceY: sy,
                    targetX: tx,
                    targetY: ty,
                });
            }
            return getBezierPath({
                sourceX,
                sourceY,
                sourcePosition,
                targetX,
                targetY,
                targetPosition,
            });
        }, [
            edgeParentNode.type,
            isAttachedToBreakPoint,
            edgeChildNode.type,
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
            _sourceX,
            _targetX,
        ]);

        const isSourceEnabled = !effectivelyDisabledNodes.has(source);

        const { removeEdgeById, addEdgeBreakpoint } = useContext(GlobalContext);
        const { functionDefinitions } = useContext(BackendContext);

        const [isHovered, setIsHovered] = useState(false);

        const { outputId } = useMemo(() => parseSourceHandle(sourceHandleId!), [sourceHandleId]);
        const definitionType =
            functionDefinitions.get(edgeParentNode.data.schemaId)?.outputDefaults.get(outputId) ??
            NeverType.instance;
        const type = useContextSelector(GlobalVolatileContext, (c) =>
            c.typeState.functions.get(source)?.outputs.get(outputId)
        );

        const [accentColor] = getTypeAccentColors(type || definitionType);
        const currentColor = selected ? shadeColor(accentColor, -40) : accentColor;

        const buttonSize = 32;

        // Prevent hovered state from getting stuck
        const hoverTimeout = useDebouncedCallback(() => {
            setIsHovered(false);
        }, 7500);

        const showRunning = animated && !paused;

        const isColliding = useContextSelector(
            GlobalVolatileContext,
            (c) => c.collidingEdge === id
        );

        const classModifier = useMemo(
            () =>
                `${getHoveredClass(isHovered)} ${getRunningStateClass(
                    sourceStatus,
                    targetStatus,
                    animateChain
                )} ${getCollidingClass(isColliding)}`,
            [isHovered, sourceStatus, targetStatus, isColliding, animateChain]
        );

        // NOTE: I know that technically speaking this is bad
        // HOWEVER: I don't want to cause a re-render on every edge change by properly settings the edges array
        // This is a tradeoff I'm willing to make
        // This is necessary because RF does not expose source/target X/Y on the edge
        useEffect(
            () => {
                // eslint-disable-next-line no-param-reassign
                data.sourceX = sourceX;
                // eslint-disable-next-line no-param-reassign
                data.sourceY = sourceY;
                // eslint-disable-next-line no-param-reassign
                data.targetX = targetX;
                // eslint-disable-next-line no-param-reassign
                data.targetY = targetY;
            },
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [sourceX, sourceY, targetX, targetY]
        );

        const menu = useEdgeMenu(id);

        const altPressed = useKeyPress(['Alt', 'Option']);
        const onClick = useCallback(
            (e: React.MouseEvent) => {
                if (altPressed) {
                    const adjustedPosition = screenToFlowPosition({
                        x: e.clientX || 0,
                        y: e.clientY || 0,
                    });
                    addEdgeBreakpoint(id, adjustedPosition);
                }
            },
            [addEdgeBreakpoint, altPressed, id, screenToFlowPosition]
        );

        return (
            <g
                className="edge-chain-group"
                style={{
                    cursor: 'pointer',
                    opacity: isSourceEnabled ? 1 : 0.5,
                    ...style,
                }}
                onClick={onClick}
                onContextMenu={menu.onContextMenu}
                onDoubleClick={() => removeEdgeById(id)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseOver={() => hoverTimeout()}
            >
                {showRunning && (
                    <path
                        className={`edge-chain-behind ${classModifier}`}
                        d={edgePath}
                        fill="none"
                        id={id}
                    />
                )}
                <path
                    className={`edge-chain ${classModifier}`}
                    d={edgePath}
                    fill="none"
                    id={id}
                    stroke={currentColor}
                />
                <path
                    d={edgePath}
                    style={{
                        strokeWidth: 18,
                        fill: 'none',
                        stroke: 'none',
                        cursor: 'pointer',
                    }}
                />
                <foreignObject
                    className="edgebutton-foreignobject"
                    height={buttonSize}
                    requiredExtensions="http://www.w3.org/1999/xhtml"
                    style={{
                        borderRadius: 100,
                        opacity: isHovered && !altPressed ? 1 : 0,
                        display: altPressed ? 'none' : 'block',
                        transitionDuration: '0.15s',
                        transitionProperty: 'opacity, background-color',
                        transitionTimingFunction: 'ease-in-out',
                    }}
                    width={buttonSize}
                    x={edgeCenterX - buttonSize / 2}
                    y={edgeCenterY - buttonSize / 2}
                >
                    <Center
                        backgroundColor={currentColor}
                        borderColor="var(--node-border-color)"
                        borderRadius={100}
                        borderWidth={2}
                        h="full"
                        transitionDuration="0.15s"
                        transitionProperty="background-color"
                        transitionTimingFunction="ease-in-out"
                        w="full"
                    >
                        <IconButton
                            isRound
                            aria-label="Remove edge button"
                            borderColor="var(--node-border-color)"
                            borderRadius={100}
                            borderWidth={2}
                            className="edgebutton"
                            icon={
                                <Icon
                                    as={TbUnlink}
                                    boxSize={5}
                                />
                            }
                            size="sm"
                            onClick={() => removeEdgeById(id)}
                        >
                            ×
                        </IconButton>
                    </Center>
                </foreignObject>
            </g>
        );
    }
);
