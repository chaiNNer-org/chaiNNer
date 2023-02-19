import { NeverType } from '@chainner/navi';
import { Center, Icon, IconButton } from '@chakra-ui/react';
import { memo, useEffect, useMemo, useState } from 'react';
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
import { getTypeAccentColors } from '../../helpers/accentColors';
import { shadeColor } from '../../helpers/colorTools';
import { useEdgeMenu } from '../../hooks/useEdgeMenu';
import './CustomEdge.scss';

export const CustomEdge = memo(
    ({
        id,
        source,
        sourceX: _sourceX,
        sourceY,
        targetX: _targetX,
        targetY,
        sourcePosition,
        targetPosition,
        selected,
        sourceHandleId,
        animated,
        data = {},
        style,
    }: EdgeProps<EdgeData>) => {
        const sourceX = _sourceX - 1; // - 8 <- To align it with the node
        const targetX = _targetX + 1; // + 8

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
        const definitionType =
            functionDefinitions.get(parentNode.data.schemaId)?.outputDefaults.get(outputId) ??
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

        const classModifier = `${isHovered ? 'hovered' : ''} ${
            showRunning && animateChain ? 'running' : ''
        } ${isColliding ? 'colliding' : ''}`;

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
                onDragEnter={() => setHoveredNode(parentNode.parentNode)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseOver={() => hoverTimeout()}
            >
                <path
                    className={`edge-chain-links ${classModifier}`}
                    d={edgePath}
                    fill="none"
                    id={id}
                    stroke={currentColor}
                />
                <path
                    className={`edge-chain ${classModifier}`}
                    d={edgePath}
                    fill="none"
                    id={id}
                    stroke={currentColor}
                />
                <path
                    className={`edge-chain dot ${classModifier}`}
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
