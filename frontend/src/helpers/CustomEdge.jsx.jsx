/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import React, { memo, useState } from 'react';
import { getBezierPath, getMarkerEnd } from 'react-flow-renderer';
import getNodeAccentColors from './getNodeAccentColors';
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

  const getCurrentColor = () => {
    if (selected) {
      return selectedColor;
    }

    if (data.complete) {
      return accentColor;
    }

    return accentColor;
  };

  return (
    <>
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
        onMouseLeave={() => setIsHovered(false)}
      />
      {/* <text>
        <textPath
          href={`#${id}`}
          style={{ fontSize: '12px' }}
          startOffset="50%"
          textAnchor="middle"
        >
          {data.text}
        </textPath>
      </text> */}
    </>
  );
};

export default memo(CustomEdge);
