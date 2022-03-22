/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import { CloseIcon, CopyIcon, DeleteIcon } from '@chakra-ui/icons';
import {
  Box, Center, Menu, MenuItem, MenuList, Portal, Text, useColorModeValue, VStack,
} from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import React, {
  memo, useContext, useEffect, useMemo, useState,
} from 'react';
import { useReactFlow } from 'react-flow-renderer';
import checkNodeValidity from '../../helpers/checkNodeValidity.js';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import shadeColor from '../../helpers/shadeColor.js';
import NodeFooter from './NodeFooter.jsx';
import NodeHeader from './NodeHeader.jsx';
import NodeInputs from './NodeInputs.jsx';
import NodeOutputs from './NodeOutputs.jsx';

const createGridDotsPath = (size, fill) => <circle cx={size} cy={size} r={size} fill={fill} />;

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

const IteratorNode = ({ data, selected }) => {
  const {
    edges, availableNodes,
  } = useContext(GlobalContext);

  const {
    getViewport,
  } = useReactFlow();

  const {
    id, inputData, isLocked, category, type,
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
        <Center boxShadow="lg">
          <VStack
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
            spacing={0}
          >
            <Center
              bg={useColorModeValue('gray.300', 'gray.700')}
              w="full"
              pt={2}
              borderTopRadius="lg"
              mb={0}
              borderWidth="0.5px"
              borderColor={borderColor}
              borderBottomWidth={0}
              transition="0.15s ease-in-out"
            >
              <VStack minWidth="240px" w="full">
                <NodeHeader
                  category={category}
                  type={type}
                  accentColor={accentColor}
                  icon={icon}
                  selected={selected}
                />
                {inputs.length && (
                <Center>
                  <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
                    INPUTS
                  </Text>
                </Center>
                )}
                <NodeInputs inputs={inputs} id={id} accentColor={accentColor} isLocked={isLocked} />
              </VStack>
            </Center>
            <VStack
              borderWidth="0.5px"
              borderColor={borderColor}
              borderBottomWidth={0}
              borderTopWidth={0}
              transition="0.15s ease-in-out"
              spacing={0}
            >
              <Center
                bg={useColorModeValue('gray.300', 'gray.700')}
                w="full"
                py={2}
                mt={0}
              >
                <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
                  ITERATION
                </Text>
              </Center>
              <Resizable
                className="nodrag"
                defaultSize={{
                  width: 480,
                  height: 480,
                }}
                minWidth="280px"
                minHeight="280px"
                draggable={false}
                // p={4}
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
                scale={getViewport().zoom}
              >
                <Box
                  className="nodrag"
                  draggable={false}
              // bg="rgba(74, 85, 104, 0.05)"
                  h="full"
                  w="full"
                  my={0}
                  boxShadow="inset 0 0 15px var(--chakra-colors-gray-700)"
                >
                  {/* Test */}
                </Box>
              </Resizable>
            </VStack>
            <Center
              bg={useColorModeValue('gray.300', 'gray.700')}
              w="full"
              py={2}
              borderBottomRadius="lg"
              mt={0}
              borderWidth="0.5px"
              borderColor={borderColor}
              borderTopWidth={0}
              transition="0.15s ease-in-out"
            >
              <VStack minWidth="240px" w="full">
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

export default memo(IteratorNode);
