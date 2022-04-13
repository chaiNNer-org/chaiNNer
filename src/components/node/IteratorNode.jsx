
import {
  Center, Text, useColorModeValue, VStack
} from '@chakra-ui/react';
import {
  memo, useContext, useEffect, useMemo, useRef, useState
} from 'react';
import checkNodeValidity from '../../helpers/checkNodeValidity.js';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import shadeColor from '../../helpers/shadeColor.js';
import IteratorNodeBody from './IteratorNodeBody.jsx';
import IteratorNodeHeader from './IteratorNodeHeader.jsx';
import NodeFooter from './NodeFooter.jsx';
import NodeInputs from './NodeInputs.jsx';
import NodeOutputs from './NodeOutputs.jsx';

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

const IteratorNodeWrapper = memo(
  ({ data, selected }) => (<IteratorNode data={data} selected={selected} />),
);

const IteratorNode = memo(({ data, selected }) => {
  const {
    edges, availableNodes, useHoveredNode,
  } = useContext(GlobalContext);

  const {
    id, inputData, isLocked, category, type, iteratorSize, maxWidth, maxHeight, percentComplete,
  } = useMemo(() => data, [data]);

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

  const iteratorBoxRef = useRef();

  useEffect(() => {
    if (inputs && inputs.length) {
      setValidity(checkNodeValidity({
        id, inputs, inputData, edges,
      }));
    }
  }, [inputData, edges.length]);

  return (
    <>
      <Center
        bg={useColorModeValue('gray.300', 'gray.700')}
        borderWidth="0.5px"
        borderColor={borderColor}
        borderRadius="lg"
        py={2}
        boxShadow="lg"
        transition="0.15s ease-in-out"
      >
        <VStack minWidth="240px">
          <IteratorNodeHeader
            category={category}
            type={type}
            accentColor={accentColor}
            icon={icon}
            selected={selected}
            percentComplete={percentComplete}
          />
          {inputs.length && (
          <Center>
            <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
              INPUTS
            </Text>
          </Center>
          )}
          <NodeInputs inputs={inputs} id={id} accentColor={accentColor} isLocked={isLocked} />
          <Center>
            <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
              ITERATION
            </Text>
          </Center>
          <Center ref={iteratorBoxRef} m={0} p={0}>
            <IteratorNodeBody
              id={id}
              iteratorSize={iteratorSize}
              maxWidth={maxWidth}
              maxHeight={maxHeight}
              accentColor={accentColor}
            />
          </Center>
          {outputs.length > 0 && (
          <Center>
            <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
              OUTPUTS
            </Text>
          </Center>
          )}
          <NodeOutputs outputs={outputs} id={id} accentColor={accentColor} />
          <NodeFooter
            id={id}
            accentColor={accentColor}
            isValid={validity[0]}
            invalidReason={validity[1]}
            isLocked={isLocked}
          />
        </VStack>
      </Center>
    </>
  );
});

export default memo(IteratorNodeWrapper);
