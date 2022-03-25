/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Box, useColorModeValue,
} from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import React, {
  memo, useContext,
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

const IteratorNodeBody = ({ id, iteratorSize }) => {
  const {
    zoom, useIteratorSize,
  } = useContext(GlobalContext);

  const [setIteratorSize, defaultSize] = useIteratorSize(id);
  const { width, height } = iteratorSize ?? defaultSize;

  return (
    <Resizable
      className="nodrag"
      defaultSize={defaultSize}
      minWidth="280px"
      minHeight="280px"
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
      }}
      size={{ width, height }}
      onResizeStop={(e, direction, ref, d) => {
        setIteratorSize({
          width: width + d.width,
          height: height + d.height,
        });
      }}
    >
      <Box
        className="nodrag"
        draggable={false}
                // bg={useColorModeValue('gray.200', 'gray.800')}
                // p={2}
        h="full"
        w="full"
        my={0}
                // boxShadow="inset 0 0 15px var(--chakra-colors-gray-700)"
                // borderWidth={4}
        borderColor="gray.700"
      >
        <Box
          bg={useColorModeValue('gray.200', 'gray.800')}
          h="full"
          w="full"
          borderWidth={1}
          borderColor="gray.600"
          borderRadius="lg"
        >
          <DotPattern id={id} />
        </Box>
        {/* Test */}
      </Box>
    </Resizable>

  );
};

export default memo(IteratorNodeBody);
