import { CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import {
  Center,
  Menu,
  MenuItem,
  MenuList,
  Portal,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react';
import { memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import checkNodeValidity from '../../helpers/checkNodeValidity.js';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import shadeColor from '../../helpers/shadeColor.ts';
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

const NodeWrapper = memo(({ data, selected }) => (
  <Node
    data={data}
    selected={selected}
  />
));

const Node = memo(({ data, selected }) => {
  const { nodes, edges, availableNodes, updateIteratorBounds, useHoveredNode } =
    useContext(GlobalContext);

  const { id, inputData, isLocked, category, type, parentNode } = useMemo(() => data, [data]);

  // We get inputs and outputs this way in case something changes with them in the future
  // This way, we have to do less in the migration file
  const schema =
    useMemo(() => getSchema(availableNodes, category, type), [category, type]) ?? blankSchema;
  const { inputs, outputs, icon, subcategory } = schema;

  const regularBorderColor = useColorModeValue('gray.400', 'gray.600');
  const accentColor = useMemo(() => getAccentColor(category, subcategory), [category, subcategory]);
  const borderColor = useMemo(
    () => (selected ? shadeColor(accentColor, 0) : regularBorderColor),
    [selected, accentColor, regularBorderColor]
  );

  const [validity, setValidity] = useState([false, '']);

  useEffect(() => {
    if (inputs && inputs.length) {
      setValidity(checkNodeValidity({ id, inputs, inputData, edges }));
    }
  }, [inputData, edges.length, nodes.length]);

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
  }, [nodes && !checkedSize, targetRef?.current?.offsetHeight]);

  // eslint-disable-next-line no-unused-vars
  const [showMenu, setShowMenu] = useState(false);
  // const [menuPosition, setMenuPosition] = useState({});

  // useEffect(() => {
  //   if (!selected) {
  //     setShowMenu(false);
  //   }
  // }, [selected]);

  const [, setHoveredNode] = useHoveredNode;

  return (
    <>
      <Menu isOpen={showMenu}>
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
            // setShowMenu(false);
          }}
          onContextMenu={() => {
            // WIP
            // if (selected) {
            //   if (showMenu) {
            //     setShowMenu(false);
            //   } else {
            //     setMenuPosition({ x: event.clientX, y: event.clientY });
            //     setShowMenu(true);
            //   }
            // }
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
              category={category}
              id={id}
              inputs={inputs}
              isLocked={isLocked}
              nodeType={type}
              outputs={outputs}
            />
            <NodeFooter
              accentColor={accentColor}
              id={id}
              invalidReason={validity[1]}
              isLocked={isLocked}
              isValid={validity[0]}
              // toggleLock={toggleLock}
            />
          </VStack>
        </Center>
        <Portal>
          <MenuList
            position="fixed"
            // top={menuPosition.y}
            // left={menuPosition.x}
          >
            <MenuItem
              icon={<CopyIcon />}
              onClick={() => {
                // duplicateNode(id);
              }}
            >
              Duplicate
            </MenuItem>
            <MenuItem
              icon={<CloseIcon />}
              onClick={() => {
                //  clearNode(id);
              }}
            >
              Clear
            </MenuItem>
            <MenuItem
              icon={<DeleteIcon />}
              onClick={() => {
                // removeNodeById(id);
              }}
            >
              Delete
            </MenuItem>
          </MenuList>
        </Portal>
      </Menu>
    </>
  );
});

export default memo(NodeWrapper);
