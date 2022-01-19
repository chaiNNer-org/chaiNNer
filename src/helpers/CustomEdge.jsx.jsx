/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { DeleteIcon } from '@chakra-ui/icons';
import { Center, IconButton, useColorModeValue } from '@chakra-ui/react';
import React, { memo, useContext, useState } from 'react';
import { getBezierPath, getEdgeCenter, getMarkerEnd } from 'react-flow-renderer';
import getNodeAccentColors from './getNodeAccentColors';
import { GlobalContext } from './GlobalNodeState.jsx';
import shadeColor from './shadeColor.js';

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  arrowHeadType,
  markerEndId,
  selected,
}) => {
  const edgePath = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });
  const markerEnd = getMarkerEnd(arrowHeadType, markerEndId);

  const [isHovered, setIsHovered] = useState(false);
  const accentColor = getNodeAccentColors(data.sourceType);
  const selectedColor = shadeColor(accentColor, -40);
  // const normalColor = useColorModeValue('gray.600', 'gray.400');

  const { removeEdgeById } = useContext(GlobalContext);

  const getCurrentColor = () => {
    if (selected) {
      return selectedColor;
    }

    if (data.complete) {
      return accentColor;
    }

    return accentColor;
  };

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

  return (
    <>
      {/* The top path is for easier hovering. Bottom one is rendered */}
      <path
        id={id}
        style={{
          ...style,
          strokeWidth: '12px',
          stroke: getCurrentColor(),
          strokeOpacity: 0,
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <path
        id={id}
        style={{
          ...style,
          strokeWidth: isHovered ? '4px' : '2px',
          stroke: getCurrentColor(),
          transitionDuration: '0.15s',
          transitionProperty: 'stroke-width, stroke',
          transitionTimingFunction: 'ease-in-out',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        onMouseEnter={() => setIsHovered(true)}
      />
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
          transitionProperty: 'opacity',
          transitionTimingFunction: 'ease-in-out',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Center
          w="full"
          h="full"
          backgroundColor={getCurrentColor()}
          borderColor={useColorModeValue('gray.100', 'gray.800')}
          borderWidth={2}
          borderRadius={100}
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
          >
            ×
          </IconButton>
        </Center>
      </foreignObject>
    </>
  );
};

export default memo(CustomEdge);
