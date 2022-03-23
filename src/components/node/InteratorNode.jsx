/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Box, Center, Text, useColorModeValue, VStack,
} from '@chakra-ui/react';
import { Resizable } from 're-resizable';
import React, {
  memo, useContext, useEffect, useMemo, useState,
} from 'react';
import checkNodeValidity from '../../helpers/checkNodeValidity.js';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import shadeColor from '../../helpers/shadeColor.js';
import NodeFooter from './NodeFooter.jsx';
import NodeHeader from './NodeHeader.jsx';
import NodeInputs from './NodeInputs.jsx';
import NodeOutputs from './NodeOutputs.jsx';

const createGridDotsPath = (size, fill) => <circle cx={size} cy={size} r={size} fill={fill} />;

const DotPattern = ({ id }) => {
  const gap = 15;
  const size = 0.5;
  const scaledGap = gap * 1;
  const path = createGridDotsPath(size, '#81818a');
  const patternId = `pattern-${id}`;

  return (
    <svg
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '0.5rem',
      }}
    >
      <pattern
        id={patternId}
        x={6}
        y={6}
        width={scaledGap}
        height={scaledGap}
        patternUnits="userSpaceOnUse"
      >
        {path}
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};

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
    edges, availableNodes, zoom,
  } = useContext(GlobalContext);

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
      <Center
        bg={useColorModeValue('gray.300', 'gray.700')}
        borderWidth="0.5px"
        borderColor={borderColor}
        borderRadius="xl"
        py={2}
        boxShadow="lg"
        transition="0.15s ease-in-out"
        onClick={() => {
          // setShowMenu(false);
        }}
      >
        <VStack minWidth="240px">
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
          <Center>
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
            scale={zoom}
            style={{
              margin: 6,
              marginBottom: 0,
            }}
          >
            <Box
              className="nodrag"
              draggable={false}
              // bg={useColorModeValue('gray.200', 'gray.800')}
              // p={2}
              h="full"
              w="full"
              my={0}
              // boxShadow="inset 0 0 15px var(--chakra-colors-gray-700)"
              // borderWidth={4}
              borderColor="gray.700"
              // borderRadius="xl"
            >
              <Box
                bg={useColorModeValue('gray.200', 'gray.800')}
                h="full"
                w="full"
                borderWidth={2}
                borderColor="gray.600"
                borderRadius="lg"
              >
                <DotPattern id={id} />
              </Box>
              {/* Test */}
            </Box>
          </Resizable>
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
};

export default memo(IteratorNode);
