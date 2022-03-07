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

const blankSchema = {
  inputs: [],
  outputs: [],
  icon: '',
  subcategory: '',
};

const getSchema = (availableNodes, category, type) => {
  if (availableNodes) {
    try {
      const schema = availableNodes[category][type];
      return schema;
    } catch (error) {
      console.log(error);
    }
  }
  return blankSchema;
};

const Node = ({ data, selected }) => {
  const {
    edges, useNodeLock, availableNodes,
  } = useContext(GlobalContext);

  const {
    id, inputData, isLocked, category, type,
  } = data;

  // We get inputs and outputs this way in case something changes with them in the future
  // This way, we have to do less in the migration file
  const schema = useMemo(
    () => getSchema(availableNodes, category, type), [category, type],
  ) ?? blankSchema;
  const {
    inputs, outputs, icon, subcategory,
  } = schema;

  const regularBorderColor = useColorModeValue('gray.400', 'gray.600');
  const accentColor = useMemo(
    () => (getAccentColor(category, subcategory)), [category, subcategory],
  );
  const borderColor = useMemo(
    () => (selected ? shadeColor(accentColor, 0) : regularBorderColor),
    [selected, accentColor, regularBorderColor],
  );

  const [validity, setValidity] = useState([false, '']);

  useEffect(() => {
    if (inputs && inputs.length) {
      setValidity(checkNodeValidity({
        id, inputs, inputData, edges,
      }));
    }
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
          icon={icon}
          selected={selected}
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
