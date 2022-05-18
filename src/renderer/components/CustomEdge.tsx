import { DeleteIcon } from '@chakra-ui/icons';
import { Center, IconButton, useColorModeValue } from '@chakra-ui/react';
import { memo, useMemo, useState } from 'react';
import { EdgeProps, getBezierPath, getEdgeCenter, useReactFlow } from 'react-flow-renderer';
import { useContext } from 'use-context-selector';
import { useDebouncedCallback } from 'use-debounce';
import { EdgeData, NodeData } from '../../common/common-types';
import { GlobalContext } from '../contexts/GlobalNodeState';
import getNodeAccentColors from '../helpers/getNodeAccentColors';
import shadeColor from '../helpers/shadeColor';

const CustomEdge = ({
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
}: EdgeProps<EdgeData>) => {
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

    const { schemata, removeEdgeById, setHoveredNode } = useContext(GlobalContext);

    const [isHovered, setIsHovered] = useState(false);

    // We dynamically grab this data instead since storing the types makes transitioning harder
    const { category } = schemata.get(parentNode.data.schemaId);
    const accentColor = getNodeAccentColors(category);
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

    return (
        <g
            style={{
                cursor: 'pointer',
            }}
            onDragEnter={() => setHoveredNode(parentNode.parentNode)}
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
                    cursor: 'pointer',
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
};

export default memo(CustomEdge);
