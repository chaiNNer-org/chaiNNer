import {
  Center, useColorModeValue, VStack,
} from '@chakra-ui/react';
import {
  memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import checkNodeValidity from '../../helpers/checkNodeValidity.js';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import shadeColor from '../../helpers/shadeColor.js';
import IteratorHelperNodeFooter from './IteratorHelperNodeFooter.jsx';
import NodeBody from './NodeBody.jsx';
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

const IteratorHelperNode = ({
  data, selected,
}) => {
  const {
    nodes, edges, availableNodes, updateIteratorBounds, useHoveredNode,
  } = useContext(GlobalContext);

  const {
    id, inputData, isLocked, category, type, parentNode,
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

  useEffect(() => {
    if (inputs && inputs.length) {
      setValidity(checkNodeValidity({
        id, inputs, inputData, edges,
      }));
    }
  }, [inputData, edges.length]);

  const targetRef = useRef();
  const [checkedSize, setCheckedSize] = useState(false);

  useLayoutEffect(() => {
    if (targetRef.current) {
      const parent = nodes.find((n) => n.id === parentNode);
      if (parent) {
        updateIteratorBounds(parentNode, parent.data.iteratorSize, {
          width: targetRef.current.offsetWidth,
          height: targetRef.current.offsetHeight,
        });
        setCheckedSize(true);
      }
    }
  }, [nodes && !checkedSize]);

  const [, setHoveredNode] = useHoveredNode;

  return (
    <Center
      bg={useColorModeValue('gray.300', 'gray.700')}
      borderColor={borderColor}
      borderRadius="lg"
      borderWidth="0.5px"
      boxShadow="lg"
      py={2}
      ref={targetRef}
      transition="0.15s ease-in-out"
      onClick={() => {
      }}
      onContextMenu={() => {
      }}
      onDragEnter={() => {
        if (parentNode) {
          setHoveredNode(parentNode);
        }
      }}
    >
      <VStack minWidth="240px">
        <NodeHeader
          accentColor={accentColor}
          category={category}
          icon={icon}
          parentNode={parentNode}
          selected={selected}
          type={type}
        />
        <NodeBody
          accentColor={accentColor}
          id={id}
          inputs={inputs}
          isLocked={isLocked}
          outputs={outputs}
        />
        <IteratorHelperNodeFooter
          accentColor={accentColor}
          id={id}
          invalidReason={validity[1]}
          isValid={validity[0]}
        />
      </VStack>
    </Center>
  );
};

export default memo(IteratorHelperNode);
