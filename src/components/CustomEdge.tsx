import { DeleteIcon } from '@chakra-ui/icons';
import { Center, IconButton, useColorModeValue } from '@chakra-ui/react';
import { memo, useCallback, useContext, useMemo, useState } from 'react';
import { getBezierPath, getEdgeCenter, Position } from 'react-flow-renderer';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalContext } from '../helpers/contexts/GlobalNodeState';
import getNodeAccentColors from '../helpers/getNodeAccentColors';
import shadeColor from '../helpers/shadeColor';

const EdgeWrapper = memo(
    ({
        id,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        style = {},
        selected,
    }: CustomEdgeProps) => (
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        <CustomEdge
            id={id}
            selected={selected}
            sourcePosition={sourcePosition}
            sourceX={sourceX}
            sourceY={sourceY}
            style={style}
            targetPosition={targetPosition}
            targetX={targetX}
            targetY={targetY}
        />
    )
);

interface CustomEdgeProps {
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
    style?: React.CSSProperties;
    selected: boolean;
}

const CustomEdge = memo(
    ({
        id,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        style = {},
        selected,
    }: CustomEdgeProps) => {
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

        const { removeEdgeById, nodes, edges, useHoveredNode } = useContext(GlobalContext);

        const edge = useMemo(() => edges.find((e) => e.id === id)!, [id]);
        const parentNode = useMemo(() => nodes.find((n) => edge.source === n.id), []);

        const [isHovered, setIsHovered] = useState(false);

        // const accentColor = getNodeAccentColors(data.sourceType, data.sourceSubCategory);
        // We dynamically grab this data instead since storing the types makes transitioning harder
        const accentColor = getNodeAccentColors(parentNode?.data.category);
        const selectedColor = useMemo(() => shadeColor(accentColor, -40), [accentColor]);
        // const normalColor = useColorModeValue('gray.600', 'gray.400');

        const getCurrentColor = useCallback(() => {
            if (selected) {
                return selectedColor;
            }

            // if (data.complete) {
            //   return accentColor;
            // }

            return accentColor;
        }, [selected, selectedColor, accentColor]);

        const currentColor = useMemo(() => getCurrentColor(), [accentColor, selected]);

        // const markerEnd = `url(#color=${getCurrentColor()}&type=${MarkerType.ArrowClosed})`;

        const [edgeCenterX, edgeCenterY] = useMemo(
            () => getEdgeCenter({ sourceX, sourceY, targetX, targetY }),
            [sourceX, sourceY, targetX, targetY]
        );

        const buttonSize = 32;

        // Prevent hovered state from getting stuck
        const hoverTimeout = useDebouncedCallback(() => {
            setIsHovered(false);
        }, 7500);

        const [, setHoveredNode] = useHoveredNode;

        return (
            <g
                style={{
                    cursor: isHovered ? 'pointer' : 'default',
                }}
                onDragEnter={() => {
                    if (parentNode) {
                        setHoveredNode(parentNode.parentNode);
                    }
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onMouseOver={() => hoverTimeout()}
            >
                <path
                    className="react-flow__edge-path"
                    d={edgePath}
                    id={id}
                    style={{
                        ...style,
                        strokeWidth: isHovered ? '4px' : '2px',
                        stroke: currentColor,
                        transitionDuration: '0.15s',
                        transitionProperty: 'stroke-width, stroke',
                        transitionTimingFunction: 'ease-in-out',
                        cursor: isHovered ? 'pointer' : 'default',
                    }}
                />
                <path
                    d={edgePath}
                    style={{
                        strokeWidth: 18,
                        fill: 'none',
                        stroke: 'none',
                        cursor: isHovered ? 'pointer' : 'default',
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
                            icon={<DeleteIcon />}
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

export default memo(EdgeWrapper);
