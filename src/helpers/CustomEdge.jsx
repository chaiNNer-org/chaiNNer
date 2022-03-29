/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { DeleteIcon } from '@chakra-ui/icons';
import {
  Center, IconButton, useColorModeValue,
} from '@chakra-ui/react';
import React, {
  memo, useContext, useMemo, useState,
} from 'react';
import {
  getBezierPath, getEdgeCenter,
} from 'react-flow-renderer';
import getNodeAccentColors from './getNodeAccentColors';
import { GlobalContext } from './GlobalNodeState.jsx';
import shadeColor from './shadeColor.js';

const EdgeWrapper = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
}) => (
  <CustomEdge
    id={id}
    sourceX={sourceX}
    sourceY={sourceY}
    targetX={targetX}
    targetY={targetY}
    sourcePosition={sourcePosition}
    targetPosition={targetPosition}
    style={style}
    selected={selected}
  />
));

const CustomEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
}) => {
  const edgePath = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const { removeEdgeById, nodes, edges } = useContext(GlobalContext);

  const edge = useMemo(() => edges.find((e) => e.id === id), []);
  const parentNode = useMemo(() => nodes.find((n) => edge.source === n.id), []);

  const [isHovered, setIsHovered] = useState(false);
  // const accentColor = getNodeAccentColors(data.sourceType, data.sourceSubCategory);
  // We dynamically grab this data instead since storing the types makes transitioning harder
  const accentColor = useMemo(
    () => getNodeAccentColors(parentNode?.data.category, parentNode?.data.subcategory),
    [parentNode],
  );
  const selectedColor = shadeColor(accentColor, -40);
  // const normalColor = useColorModeValue('gray.600', 'gray.400');

  const getCurrentColor = () => {
    if (selected) {
      return selectedColor;
    }

    // if (data.complete) {
    //   return accentColor;
    // }

    return accentColor;
  };

  const currentColor = useMemo(() => getCurrentColor(), [accentColor, selected]);

  // const markerEnd = `url(#color=${getCurrentColor()}&type=${MarkerType.ArrowClosed})`;

  const [edgeCenterX, edgeCenterY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const buttonSize = 32;

  const onEdgeClick = (evt, edgeId) => {
    evt.stopPropagation();
    removeEdgeById(edgeId);
  };

  const GhostPath = ({ d }) => (
    <path
      d={d}
      style={{
        strokeWidth: 14,
        fill: 'none',
        stroke: 'none',
        cursor: isHovered ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      // onMouseOver={() => setIsHovered(true)}
      onMouseOut={() => setIsHovered(false)}
    />
  );

  return (
    <>
      <g>
        {/* <GhostPath d={edgePath} /> */}
        <path
          id={id}
          style={{
            ...style,
            strokeWidth: isHovered ? '4px' : '2px',
            stroke: currentColor,
            transitionDuration: '0.15s',
            transitionProperty: 'stroke-width, stroke',
            transitionTimingFunction: 'ease-in-out',
            zIndex: 1000,
            cursor: isHovered ? 'pointer' : 'default',
          }}
          className="react-flow__edge-path"
          d={edgePath}
          // markerEnd={markerEnd}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          // onMouseOver={() => setIsHovered(true)}
          onMouseOut={() => setIsHovered(false)}
        />
      </g>
      <foreignObject
        width={buttonSize}
        height={buttonSize}
        x={edgeCenterX - (buttonSize) / 2}
        y={edgeCenterY - (buttonSize) / 2}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
        style={{
          borderRadius: 100,
          opacity: isHovered ? 1 : 0,
          transitionDuration: '0.15s',
          transitionProperty: 'opacity, background-color',
          transitionTimingFunction: 'ease-in-out',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Center
          w="full"
          h="full"
          backgroundColor={currentColor}
          borderColor={useColorModeValue('gray.100', 'gray.800')}
          borderWidth={2}
          borderRadius={100}
          transitionDuration="0.15s"
          transitionProperty="background-color"
          transitionTimingFunction="ease-in-out"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <IconButton
            className="edgebutton"
            icon={<DeleteIcon />}
            onClick={(event) => onEdgeClick(event, id)}
            isRound
            size="sm"
            borderColor={useColorModeValue('gray.100', 'gray.800')}
            borderWidth={2}
            borderRadius={100}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            ×
          </IconButton>
        </Center>
      </foreignObject>
    </>
  );
});

export default memo(EdgeWrapper);
