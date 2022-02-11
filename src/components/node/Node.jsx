/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { Center, useColorModeValue, VStack } from '@chakra-ui/react';
import React, {
  memo, useContext, useEffect, useMemo, useState,
} from 'react';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import shadeColor from '../../helpers/shadeColor.js';
import NodeBody from './NodeBody.jsx';
import NodeFooter from './NodeFooter.jsx';
import NodeHeader from './NodeHeader.jsx';

const Node = ({ children, data, selected }) => {
  // console.log('🚀 ~ file: Node.jsx ~ line 15 ~ Node ~ data', data);
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
    console.log('performance check (inner isvalid)');
    if (!inputs) {
      return setValidity([false, 'Node has no inputs.']);
    }
    const filteredEdges = edges.filter((e) => e.target === id);

    // Check to make sure the node has all the data it should based on the schema.
    // Compares the schema against the connections and the entered data
    const nonOptionalInputs = inputs.filter((input) => !input.optional);
    const emptyInputs = Object.entries(inputData).filter(([, value]) => value === '' || value === undefined || value === null).map(([key]) => String(key));
    // eslint-disable-next-line max-len
    const isMissingInputs = nonOptionalInputs.length > Object.keys(inputData).length + filteredEdges.length;
    if (isMissingInputs || emptyInputs.length > 0) {
      // Grabs all the indexes of the inputs that the connections are targeting
      const edgeTargetIndexes = edges.filter((edge) => edge.target === id).map((edge) => edge.targetHandle.split('-').slice(-1)[0]);
      // Grab all inputs that do not have data or a connected edge
      const missingInputs = nonOptionalInputs.filter(
        (input, i) => !Object.keys(inputData).includes(String(i))
        && !edgeTargetIndexes.includes(String(i)),
      );
      // TODO: This fails to output the missing inputs when a node is connected to another
      return setValidity([false, `Missing required input data: ${missingInputs.map((input) => input.label).join(', ')}`]);
    }
    return setValidity([true, '']);
  }, [inputData, edges]);

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
