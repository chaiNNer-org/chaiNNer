import { Center, useColorModeValue, VStack } from '@chakra-ui/react';
import { memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NodeData } from '../../common-types';
import checkNodeValidity from '../../helpers/checkNodeValidity';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';
import getAccentColor from '../../helpers/getNodeAccentColors';
import { getSchema } from '../../helpers/schema';
import shadeColor from '../../helpers/shadeColor';
import IteratorHelperNodeFooter from './IteratorHelperNodeFooter';
import NodeBody from './NodeBody';
import NodeHeader from './NodeHeader';

interface IteratorHelperNodeProps {
  data: NodeData;
  selected: boolean;
}

const IteratorHelperNode = ({ data, selected }: IteratorHelperNodeProps) => {
  const { nodes, edges, availableNodes, updateIteratorBounds, useHoveredNode } =
    useContext(GlobalContext);

  const { id, inputData, isLocked, category, type, parentNode } = data;

  // We get inputs and outputs this way in case something changes with them in the future
  // This way, we have to do less in the migration file
  const schema = getSchema(availableNodes, category, type);
  const { inputs, outputs, icon } = schema;

  const regularBorderColor = useColorModeValue('gray.400', 'gray.600');
  const accentColor = getAccentColor(category);
  const borderColor = useMemo(
    () => (selected ? shadeColor(accentColor, 0) : regularBorderColor),
    [selected, accentColor, regularBorderColor]
  );

  const [validity, setValidity] = useState<[boolean, string]>([false, '']);

  useEffect(() => {
    if (inputs && inputs.length) {
      setValidity(checkNodeValidity({ id, inputs, inputData, edges }));
    }
  }, [inputData, edges.length]);

  const targetRef = useRef<HTMLDivElement>(null);
  const [checkedSize, setCheckedSize] = useState(false);

  useLayoutEffect(() => {
    if (targetRef.current && parentNode) {
      const parent = nodes.find((n) => n.id === parentNode);
      if (parent) {
        updateIteratorBounds(parentNode, parent.data.iteratorSize!, {
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
      onClick={() => {}}
      onContextMenu={() => {}}
      onDragEnter={() => {
        if (parentNode) {
          setHoveredNode(parentNode);
        }
      }}
    >
      <VStack minWidth="240px">
        <NodeHeader
          accentColor={accentColor}
          icon={icon}
          parentNode={parentNode}
          selected={selected}
          type={type}
        />
        <NodeBody
          category={category}
          nodeType={type}
          accentColor={accentColor}
          id={id}
          inputs={inputs}
          isLocked={isLocked}
          outputs={outputs}
        />
        <IteratorHelperNodeFooter
          invalidReason={validity[1]}
          isValid={validity[0]}
        />
      </VStack>
    </Center>
  );
};

export default memo(IteratorHelperNode);
