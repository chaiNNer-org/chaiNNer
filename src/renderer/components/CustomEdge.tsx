import { Center, Icon, IconButton, useColorModeValue } from '@chakra-ui/react';
import { memo, useMemo, useState } from 'react';
import { EdgeProps, getBezierPath, getEdgeCenter, useReactFlow } from 'react-flow-renderer';
import { TbUnlink } from 'react-icons/tb';
import { useContext, useContextSelector } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { EdgeData, NodeData } from '../../common/common-types';
import { parseSourceHandle } from '../../common/util';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { SettingsContext } from '../contexts/SettingsContext';
import { shadeColor } from '../helpers/colorTools';
import { DisabledStatus, getDisabledStatus } from '../helpers/disabled';
import { getTypeAccentColors } from '../helpers/getTypeAccentColors';

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
        style = {},
        selected,
        sourceHandleId,
        animated,
    }: EdgeProps<EdgeData>) => {
        const effectivelyDisabledNodes = useContextSelector(
            GlobalVolatileContext,
            (c) => c.effectivelyDisabledNodes
        );
        const { useIsDarkMode, useAnimateChain } = useContext(SettingsContext);
        const [isDarkMode] = useIsDarkMode;
        const [animateChain] = useAnimateChain;

        const edgePath = useMemo(
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
        const parentNode = useMemo(() => getNode(source)!, [source]);
        const disabledStatus = useMemo(
            () => getDisabledStatus(parentNode.data, effectivelyDisabledNodes),
            [parentNode.data, effectivelyDisabledNodes]
        );

        const { removeEdgeById, setHoveredNode, functionDefinitions, typeDefinitions } =
            useContext(GlobalContext);

        const [isHovered, setIsHovered] = useState(false);

        const { inOutId } = useMemo(() => parseSourceHandle(sourceHandleId!), [sourceHandleId]);
        const type = functionDefinitions
            .get(parentNode.data.schemaId)!
            .outputDefaults.get(inOutId)!;

        const [accentColor] = getTypeAccentColors(type, typeDefinitions, isDarkMode);
        const currentColor = selected ? shadeColor(accentColor, -40) : accentColor;

        const [edgeCenterX, edgeCenterY] = useMemo(
            () => getEdgeCenter({ sourceX, sourceY, targetX, targetY }),
            [sourceX, sourceY, targetX, targetY]
        );

        const buttonSize = 32;

        // Prevent hovered state from getting stuck
        const hoverTimeout = useDebouncedCallback(() => {
            setIsHovered(false);
        }, 7500);

        const chainHoleColor = useColorModeValue('#EDF2F7', '#1A202C');

        return (
            <g
                className="edge-chain-group"
                style={{
                    cursor: 'pointer',
                    opacity: disabledStatus === DisabledStatus.Enabled ? 1 : 0.5,
                }}
                onDragEnter={() => setHoveredNode(parentNode.parentNode)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseOver={() => hoverTimeout()}
            >
                <path
                    className="edge-chain-links"
                    d={edgePath}
                    fill="none"
                    id={id}
                    strokeDasharray="0 !important"
                    style={{
                        ...style,
                        strokeWidth: isHovered ? '4px' : '2px',
                        stroke: currentColor,
                        transitionDuration: '0.15s',
                        transitionProperty: 'stroke-width, stroke',
                        transitionTimingFunction: 'ease-in-out',
                        cursor: 'pointer',
                        strokeDasharray: '0 !important',
                    }}
                />
                <path
                    className="edge-chain"
                    d={edgePath}
                    fill="none"
                    id={id}
                    strokeDasharray="1 10"
                    strokeDashoffset="2"
                    strokeLinecap="round"
                    style={{
                        ...style,
                        strokeWidth: isHovered ? '8px' : '6px',
                        stroke: currentColor,
                        transitionDuration: '0.15s',
                        transitionProperty: 'stroke-width, stroke',
                        transitionTimingFunction: 'ease-in-out',
                        cursor: 'pointer',
                        animation:
                            animated && animateChain
                                ? 'dashdraw-chain 0.5s linear infinite'
                                : 'none',
                        opacity: animated ? 1 : 0,
                    }}
                />
                <path
                    className="edge-chain"
                    d={edgePath}
                    fill="none"
                    id={id}
                    strokeDasharray="1 10"
                    strokeDashoffset="2"
                    strokeLinecap="round"
                    style={{
                        ...style,
                        strokeWidth: isHovered ? '4px' : '3px',
                        stroke: chainHoleColor,
                        transitionDuration: '0.15s',
                        transitionProperty: 'stroke-width, stroke',
                        transitionTimingFunction: 'ease-in-out',
                        cursor: 'pointer',
                        animation:
                            animated && animateChain
                                ? 'dashdraw-chain 0.5s linear infinite'
                                : 'none',
                        opacity: animated ? 1 : 0,
                    }}
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
                        borderColor={useColorModeValue('gray.100', 'gray.800')}
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
                            borderColor={useColorModeValue('gray.100', 'gray.800')}
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
