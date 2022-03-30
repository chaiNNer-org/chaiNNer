/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Box, useColorModeValue,
} from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import React, {
  memo, useContext, useLayoutEffect, useState,
} from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const createGridDotsPath = (size, fill) => <circle cx={size} cy={size} r={size} fill={fill} />;

const DotPattern = ({ id }) => {
  const gap = 15;
  const size = 0.5;
  const scaledGap = gap * 1;
  const path = createGridDotsPath(size, '#81818a');
  const patternId = `pattern-${id}`;

  return (
    <svg
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '0.5rem',
      }}
    >
      <pattern
        id={patternId}
        x={6}
        y={6}
        width={scaledGap}
        height={scaledGap}
        patternUnits="userSpaceOnUse"
      >
        {path}
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};

const IteratorNodeBody = ({
  id, iteratorSize, accentColor, maxWidth = 256, maxHeight = 256,
}) => {
  const {
    zoom, useIteratorSize, useHoveredNode, updateIteratorBounds,
  } = useContext(GlobalContext);

  const [hoveredNode, setHoveredNode] = useHoveredNode;
  const [setIteratorSize, defaultSize] = useIteratorSize(id);
  const { width, height } = iteratorSize ?? defaultSize;

  const [dragging, setDragging] = useState(false);

  const [resizeRef, setResizeRef] = useState(null);

  useLayoutEffect(() => {
    if (resizeRef) {
      const { resizable } = resizeRef;
      const size = {
        offsetTop: resizable.offsetTop,
        offsetLeft: resizable.offsetLeft,
        width: width || defaultSize.width,
        height: height || defaultSize.height,
      };
      setIteratorSize(size);
      updateIteratorBounds(id, size);
    }
  }, [resizeRef]);

  return (
    <Resizable
      className="nodrag"
      defaultSize={defaultSize}
      minWidth={maxWidth}
      minHeight={maxHeight}
      draggable={false}
      enable={{
        top: false,
        right: true,
        bottom: true,
        left: false,
        topRight: false,
        bottomRight: true,
        bottomLeft: false,
        topLeft: false,
      }}
      scale={zoom}
      style={{
        margin: 8,
        marginBottom: 0,
        marginTop: 0,
      }}
      size={{
        width: width < maxWidth ? maxWidth : width,
        height: height < maxHeight ? maxHeight : height,
      }}
      onResizeStop={(e, direction, ref, d) => {
        const size = {
          offsetTop: ref.offsetTop,
          offsetLeft: ref.offsetLeft,
          width: (width < maxWidth ? maxWidth : width) + d.width,
          height: (height < maxHeight ? maxHeight : height) + d.height,
        };
        setIteratorSize(size);
        updateIteratorBounds(id, size);
      }}
      ref={(r) => { setResizeRef(r); }}
    >
      <Box
        className="nodrag"
        draggable={false}
        h="full"
        w="full"
        my={0}
        onDragEnter={() => {
          setHoveredNode(id);
          setDragging(true);
        }}
        onDragLeave={() => {
          setHoveredNode(null);
          setDragging(false);
        }}
      >
        <Box
          bg={useColorModeValue('gray.200', 'gray.800')}
          h="full"
          w="full"
          borderWidth={1}
          borderColor={hoveredNode === id ? accentColor : useColorModeValue('gray.400', 'gray.600')}
          borderRadius="lg"
          transition="0.15s ease-in-out"
        >
          <DotPattern id={id} />
          {/* <Icon as={GrBottomCorner} color="red.500" position="absolute" right={0} bottom={0} m={1} size="sm" /> */}
        </Box>
      </Box>
    </Resizable>

  );
};

export default memo(IteratorNodeBody);
