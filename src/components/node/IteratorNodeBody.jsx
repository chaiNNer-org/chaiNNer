import { Box, useColorModeValue } from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import { memo, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';
import { SettingsContext } from '../../helpers/contexts/SettingsContext';

const createGridDotsPath = (size, fill) => (
  <circle
    cx={size}
    cy={size}
    fill={fill}
    r={size}
  />
);

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
        height={scaledGap}
        id={patternId}
        patternUnits="userSpaceOnUse"
        width={scaledGap}
        x={6}
        y={6}
      >
        {path}
      </pattern>
      <rect
        fill={`url(#${patternId})`}
        height="100%"
        width="100%"
        x="0"
        y="0"
      />
    </svg>
  );
};

const IteratorNodeBody = ({ id, iteratorSize, accentColor, maxWidth = 256, maxHeight = 256 }) => {
  const { zoom, useIteratorSize, useHoveredNode, updateIteratorBounds } = useContext(GlobalContext);

  const { useSnapToGrid } = useContext(SettingsContext);
  const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

  const [hoveredNode, setHoveredNode] = useHoveredNode;
  const [setIteratorSize, defaultSize] = useIteratorSize(id);
  const { width, height } = iteratorSize ?? defaultSize;

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
      grid={useMemo(
        () => (isSnapToGrid ? [snapToGridAmount, snapToGridAmount] : [1, 1]),
        [isSnapToGrid, snapToGridAmount]
      )}
      minHeight={maxHeight}
      minWidth={maxWidth}
      ref={(r) => {
        setResizeRef(r);
      }}
      scale={zoom}
      size={{
        width: width < maxWidth ? maxWidth : width,
        height: height < maxHeight ? maxHeight : height,
      }}
      style={{
        margin: 8,
        marginBottom: 0,
        marginTop: 0,
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
    >
      <Box
        className="nodrag"
        draggable={false}
        h="full"
        my={0}
        w="full"
        onDragEnter={() => {
          setHoveredNode(id);
        }}
        onDragLeave={() => {
          setHoveredNode(null);
        }}
      >
        <Box
          bg={useColorModeValue('gray.200', 'gray.800')}
          borderColor={hoveredNode === id ? accentColor : useColorModeValue('gray.400', 'gray.600')}
          borderRadius="lg"
          borderWidth={1}
          h="full"
          transition="0.15s ease-in-out"
          w="full"
        >
          <DotPattern id={id} />
        </Box>
      </Box>
    </Resizable>
  );
};

export default memo(IteratorNodeBody);
