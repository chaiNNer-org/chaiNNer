/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import {
  Center, Menu, MenuItem, MenuList, Portal, useColorModeValue, VStack,
} from '@chakra-ui/react';
import React, {
  memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
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

const Node = ({
  data, selected,
}) => {
  const {
    nodes, edges, availableNodes, updateIteratorBounds,
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

  // eslint-disable-next-line no-unused-vars
  const [showMenu, setShowMenu] = useState(false);
  // const [menuPosition, setMenuPosition] = useState({});

  // useEffect(() => {
  //   if (!selected) {
  //     setShowMenu(false);
  //   }
  // }, [selected]);

  return (
    <>
      <Menu isOpen={showMenu}>
        <Center
          bg={useColorModeValue('gray.300', 'gray.700')}
          borderWidth="0.5px"
          borderColor={borderColor}
          borderRadius="lg"
          py={2}
          boxShadow="lg"
          transition="0.15s ease-in-out"
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
          onClick={() => {
            // setShowMenu(false);
          }}
          ref={targetRef}
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
              isValid={validity[0]}
              invalidReason={validity[1]}
              isLocked={isLocked}
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
};

export default memo(Node);
