import { Center, Icon, IconButton } from '@chakra-ui/react';
import { memo, useMemo, useState } from 'react';
import { TbUnlink } from 'react-icons/tb';
import { EdgeProps, getBezierPath, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { EdgeData, NodeData } from '../../../common/common-types';
import { parseSourceHandle } from '../../../common/util';
import { BackendContext } from '../../contexts/BackendContext';
import { ExecutionStatusContext } from '../../contexts/ExecutionContext';
import { GlobalContext, GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { shadeColor } from '../../helpers/colorTools';
import { getTypeAccentColors } from '../../helpers/getTypeAccentColors';
import './CustomEdge.scss';

export const CustomEdge = memo(
    ({
        id,
        source,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        selected,
        sourceHandleId,
        animated,
    }: EdgeProps<EdgeData>) => {
        const effectivelyDisabledNodes = useContextSelector(
            GlobalVolatileContext,
            (c) => c.effectivelyDisabledNodes
        );
        const { useAnimateChain } = useContext(SettingsContext);
        const { paused } = useContext(ExecutionStatusContext);
        const [animateChain] = useAnimateChain;

        const [edgePath, edgeCenterX, edgeCenterY] = useMemo(
            () =>
                getBezierPath({
                    sourceX,
                    sourceY,
                    sourcePosition,
                    targetX,
                    targetY,
                    targetPosition,
                }),
            [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]
        );

        const { getNode } = useReactFlow<NodeData, EdgeData>();
        const parentNode = useMemo(() => getNode(source)!, [source, getNode]);
        const isSourceEnabled = !effectivelyDisabledNodes.has(source);

        const { removeEdgeById, setHoveredNode } = useContext(GlobalContext);
        const { functionDefinitions } = useContext(BackendContext);

        const [isHovered, setIsHovered] = useState(false);

        const { outputId } = useMemo(() => parseSourceHandle(sourceHandleId!), [sourceHandleId]);
        const definitionType = functionDefinitions
            .get(parentNode.data.schemaId)!
            .outputDefaults.get(outputId)!;
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

        return (
            <g
                className="edge-chain-group"
                style={{
                    cursor: 'pointer',
                    opacity: isSourceEnabled ? 1 : 0.5,
                }}
                onDoubleClick={() => removeEdgeById(id)}
                onDragEnter={() => setHoveredNode(parentNode.parentNode)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseOver={() => hoverTimeout()}
            >
                <path
                    className={useMemo(
                        () =>
                            `edge-chain-links ${isHovered ? 'hovered' : ''} ${
                                showRunning && animateChain ? 'running' : ''
                            }`,
                        [isHovered, showRunning, animateChain]
                    )}
                    d={edgePath}
                    fill="none"
                    id={id}
                    stroke={currentColor}
                />
                <path
                    className={useMemo(
                        () =>
                            `edge-chain ${isHovered ? 'hovered' : ''} ${
                                showRunning && animateChain ? 'running' : ''
                            }`,
                        [isHovered, showRunning, animateChain]
                    )}
                    d={edgePath}
                    fill="none"
                    id={id}
                    stroke={currentColor}
                />
                <path
                    className={useMemo(
                        () =>
                            `edge-chain dot ${isHovered ? 'hovered' : ''} ${
                                showRunning && animateChain ? 'running' : ''
                            }`,
                        [isHovered, showRunning, animateChain]
                    )}
                    d={edgePath}
                    fill="none"
                    id={id}
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
                        opacity: isHovered ? 1 : 0,
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
