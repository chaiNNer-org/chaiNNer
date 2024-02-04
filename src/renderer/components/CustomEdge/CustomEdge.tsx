import { NeverType } from '@chainner/navi';
import { Box, Center, Icon, IconButton } from '@chakra-ui/react';
import { memo, useEffect, useMemo, useState } from 'react';
import { TbUnlink } from 'react-icons/tb';
import { EdgeProps, Position, getBezierPath, useReactFlow } from 'reactflow';
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

type PathInfo = {
    path: string;
    labelX: number;
    labelY: number;
    offsetX: number;
    offsetY: number;
    breakSourceX: number;
    breakSourceY: number;
    breakTargetX: number;
    breakTargetY: number;
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

        // const [edgePath, edgeCenterX, edgeCenterY] = useMemo(
        //     () =>
        //         getBezierPath({
        //             sourceX,
        //             sourceY,
        //             sourcePosition,
        //             targetX,
        //             targetY,
        //             targetPosition,
        //         }),
        //     [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]
        // );

        const { getNode } = useReactFlow<NodeData, EdgeData>();
        const edgeParentNode = useMemo(() => getNode(source)!, [source, getNode]);
        const isSourceEnabled = !effectivelyDisabledNodes.has(source);

        const { removeEdgeById } = useContext(GlobalContext);
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
        const breakPointSize = 8;

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

        const paths = useMemo<PathInfo[]>(() => {
            const breakpoints = [
                [sourceX, sourceY],
                ...(data.breakpoints ?? []),
                [targetX, targetY],
            ];
            const pathsToRender: PathInfo[] = [];
            for (let i = 0; i < breakpoints.length - 1; i += 1) {
                const [x1, y1] = breakpoints[i];
                const [x2, y2] = breakpoints[i + 1];
                const [path, labelX, labelY, offsetX, offsetY] = getBezierPath({
                    sourceX: x1,
                    sourceY: y1,
                    sourcePosition: Position.Right,
                    targetX: x2,
                    targetY: y2,
                    targetPosition: Position.Left,
                });
                pathsToRender.push({
                    path,
                    labelX,
                    labelY,
                    offsetX,
                    offsetY,
                    breakSourceX: x1,
                    breakSourceY: y1,
                    breakTargetX: x2,
                    breakTargetY: y2,
                });
            }
            return pathsToRender;
        }, [sourceX, sourceY, data.breakpoints, targetX, targetY]);

        return (
            <g
                className="edge-chain-group"
                style={{
                    cursor: 'pointer',
                    opacity: isSourceEnabled ? 1 : 0.5,
                    ...style,
                }}
                onContextMenu={menu.onContextMenu}
                onDoubleClick={() => removeEdgeById(id)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseOver={() => hoverTimeout()}
            >
                {paths.map((pathInfo, index) => (
                    <g key={pathInfo.path}>
                        {showRunning && (
                            <path
                                className={`edge-chain-behind ${classModifier}`}
                                d={pathInfo.path}
                                fill="none"
                                id={id}
                            />
                        )}
                        <path
                            className={`edge-chain ${classModifier}`}
                            d={pathInfo.path}
                            fill="none"
                            id={id}
                            stroke={currentColor}
                        />
                        <path
                            d={pathInfo.path}
                            style={{
                                strokeWidth: 18,
                                fill: 'none',
                                stroke: 'none',
                                cursor: 'pointer',
                            }}
                        />
                        {index > 0 && (
                            <foreignObject
                                className="edgebutton-foreignobject"
                                height={breakPointSize}
                                requiredExtensions="http://www.w3.org/1999/xhtml"
                                style={{
                                    borderRadius: 100,
                                    backgroundColor: accentColor,
                                    borderWidth: 1,
                                }}
                                width={breakPointSize}
                                x={pathInfo.breakSourceX - breakPointSize / 2}
                                y={pathInfo.breakSourceY - breakPointSize / 2}
                            >
                                <Box
                                    backgroundColor={accentColor}
                                    borderRadius="full"
                                    h="full"
                                    w="full"
                                />
                            </foreignObject>
                        )}
                        <foreignObject
                            className="edgebutton-foreignobject"
                            height={buttonSize}
                            requiredExtensions="http://www.w3.org/1999/xhtml"
                            style={{
                                borderRadius: 100,
                                opacity: isHovered ? 1 : 0,
                                transitionDuration: '0.15s',
                                transitionProperty: 'opacity, background-color',
                                transitionTimingFunction: 'ease-in-out',
                            }}
                            width={buttonSize}
                            x={pathInfo.labelX - buttonSize / 2}
                            y={pathInfo.labelY - buttonSize / 2}
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
                ))}
            </g>
        );
    }
);
