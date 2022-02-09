/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { Center, useColorModeValue, VStack } from '@chakra-ui/react';
import React, {
  memo, useMemo,
} from 'react';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import shadeColor from '../../helpers/shadeColor.js';
// useContext, useEffect, useMemo,
import NodeBody from './NodeBody.jsx';
import NodeFooter from './NodeFooter.jsx';
import NodeHeader from './NodeHeader.jsx';

const Node = ({ children, data, selected }) => {
  const accentColor = useMemo(() => (getAccentColor(data?.category)), [data?.category]);
  const borderColor = useMemo(() => (selected ? shadeColor(accentColor, 0) : 'inherit'), [selected, accentColor]);

  return (
    <Center
      bg={useColorModeValue('gray.300', 'gray.700')}
      borderWidth="0.5px"
      borderColor={borderColor}
      borderRadius="lg"
      py={2}
      boxShadow="lg"
      transition="0.15s ease-in-out"
      // opacity="0.95"
    >
      <VStack minWidth="240px">
        <NodeHeader data={data} accentColor={accentColor} />
        <NodeBody data={data} accentColor={accentColor} />
        <NodeFooter data={data} accentColor={accentColor} />
      </VStack>
    </Center>
  );
};

export default memo(Node);
