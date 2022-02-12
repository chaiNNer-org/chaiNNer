/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { Center, useColorModeValue, VStack } from '@chakra-ui/react';
import React, {
  memo, useContext, useEffect, useMemo, useState,
} from 'react';
import checkNodeValidity from '../../helpers/checkNodeValidity.js';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import shadeColor from '../../helpers/shadeColor.js';
import NodeBody from './NodeBody.jsx';
import NodeFooter from './NodeFooter.jsx';
import NodeHeader from './NodeHeader.jsx';

const Node = ({ data, selected }) => {
  const {
    edges, useNodeLock,
  } = useContext(GlobalContext);

  const accentColor = useMemo(() => (getAccentColor(data?.category)), [data?.category]);
  const borderColor = useMemo(() => (selected ? shadeColor(accentColor, 0) : 'inherit'), [selected, accentColor]);

  const {
    id, inputs, inputData, isLocked, outputs, category, type,
  } = data;
  const [validity, setValidity] = useState([false, '']);

  useEffect(() => {
    setValidity(checkNodeValidity({
      id, inputs, inputData, edges,
    }));
  }, [inputData, edges.length]);

  const [, toggleLock] = useNodeLock(id);

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
        <NodeHeader
          category={category}
          type={type}
          accentColor={accentColor}
        />
        <NodeBody
          inputs={inputs}
          outputs={outputs}
          id={id}
          accentColor={accentColor}
          isLocked={isLocked}
        />
        <NodeFooter
          id={id}
          accentColor={accentColor}
          validity={validity}
          isLocked={isLocked}
          toggleLock={toggleLock}
        />
      </VStack>
    </Center>
  );
};

export default memo(Node);
