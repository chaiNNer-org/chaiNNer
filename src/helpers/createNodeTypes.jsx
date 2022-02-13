/* eslint-disable import/extensions */
/* eslint-disable import/prefer-default-export */
/* eslint-disable react/prop-types */
import {
  Center, Heading, HStack, useColorModeValue, VStack,
} from '@chakra-ui/react';
import React, {
  memo, useMemo,
} from 'react';
import { IconFactory } from '../components/CustomIcons.jsx';
import Node from '../components/node/Node.jsx';
import getAccentColor from './getNodeAccentColors.js';
import shadeColor from './shadeColor.js';

// export const CreateUsableInputs = memo(({ data }) => data.inputs.map((input, i) => {
//   switch (input.type) {
//     case 'file::image':
//       return (
//         <FileInput
//           key={i}
//           index={i}
//           extensions={input.filetypes}
//           data={data}
//           label={input.label}
//         />
//       );
//     case 'file::pth':
//       return (
//         <FileInput key={i} index={i} extensions={input.filetypes} data={data} label={input.label} />
//       );
//     case 'file::directory':
//       return (
//         <DirectoryInput key={i} index={i} data={data} label={input.label} />
//       );
//     case 'text::any':
//       return (
//         <TextInput key={i} index={i} data={data} label={input.label} />
//       );
//     case 'dropdown::image-extensions':
//       return (
//         <DropDownInput key={i} index={i} data={data} label={input.label} options={input.options} />
//       );
//     case 'dropdown::generic':
//       return (
//         <DropDownInput key={i} index={i} data={data} label={input.label} options={input.options} />
//       );
//     case 'number::any':
//       return (
//         <NumberInput
//           key={i}
//           index={i}
//           data={data}
//           label={input.label}
//           min={input.min}
//           step={input.step}
//         />
//       );
//     case 'number::integer':
//       return (
//         <NumberInput
//           key={i}
//           index={i}
//           data={data}
//           label={input.label}
//           min={input.min}
//           precision={0}
//         />
//       );
//     case 'number::integer::odd':
//       return (
//         <NumberInput
//           key={i}
//           index={i}
//           data={data}
//           label={input.label}
//           min={1}
//           precision={0}
//           def={1}
//           step={2}
//         />
//       );
//     case 'number::slider':
//       return (
//         <SliderInput
//           key={i}
//           index={i}
//           data={data}
//           label={input.label}
//           min={input.min}
//           max={input.max}
//           def={input.def}
//         />
//       );
//     default:
//       return (
//         <GenericInput key={i} index={i} label={input.label} data={data} />
//       );
//   }
// }));

// export const createRepresentativeInputs = (category, node) => (
//   node.inputs.map((input, i) => (
//     <GenericInput key={i} label={input.label} hasHandle={false} />
//   ))
// );

// export const CreateUsableOutputs = memo(({ data }) => data.outputs.map((output, i) => {
//   switch (output.type) {
//     // case 'numpy::2d':
//     //   return (
//     //     <ImageOutput key={i} index={i} data={data} label={output.label} />
//     //   );
//     default:
//       return (
//         <GenericOutput key={i} index={i} label={output.label} data={data} />
//       );
//   }
// }));

// export const createRepresentativeOutputs = (category, node) => (
//   node.outputs.map((output, i) => (
//     <GenericOutput key={i} label={output.label} hasHandle={false} />
//   ))
// );

// const BottomArea = memo(({ data }) => {
//   const { id } = data;
//   const {
//     removeNodeById, useNodeLock, useNodeValidity, duplicateNode, clearNode,
//   } = useContext(GlobalContext);
//   const [isLocked, toggleLock] = useNodeLock(id);
//   const [isValid, invalidReason] = useNodeValidity(id);

//   return (
//     <Flex w="full" pl={2} pr={2}>
//       <Center>
//         <Icon as={isLocked ? LockIcon : UnlockIcon} mt={-1} mb={-1} color={useColorModeValue('gray.300', 'gray.800')} onClick={() => toggleLock()} cursor="pointer" />
//       </Center>
//       <Spacer />
//       <Tooltip
//         label={isValid ? 'Node valid' : invalidReason}
//         closeOnClick={false}
//         hasArrow
//         gutter={24}
//         textAlign="center"
//       >
//         <Center>
//           <Icon as={isValid ? CheckCircleIcon : WarningIcon} mt={-1} mb={-1} color={useColorModeValue('gray.300', 'gray.800')} cursor="default" />
//         </Center>
//       </Tooltip>
//       <Spacer />
//       <Center>
//         <Menu>
//           <MenuButton as={Center} mb={-2} mt={-2} w={6} h={6} cursor="pointer" verticalAlign="middle">
//             <Center>
//               <Icon as={MdMoreHoriz} mb={-2} mt={-2} w={6} h={6} color={useColorModeValue('gray.300', 'gray.800')} />
//             </Center>
//           </MenuButton>
//           <Portal>
//             <MenuList>
//               <MenuItem
//                 icon={<CopyIcon />}
//                 onClick={() => {
//                   duplicateNode(id);
//                 }}
//               >
//                 Duplicate
//               </MenuItem>
//               <MenuItem
//                 icon={<CloseIcon />}
//                 onClick={() => {
//                   clearNode(id);
//                 }}
//               >
//                 Clear
//               </MenuItem>
//               <MenuItem
//                 icon={<DeleteIcon />}
//                 onClick={() => {
//                   removeNodeById(id);
//                 }}
//               >
//                 Delete
//               </MenuItem>
//             </MenuList>
//           </Portal>
//         </Menu>
//       </Center>
//     </Flex>
//   );
// });

const NodeHeader = memo(({ data, width }) => {
  const { category, type, icon } = data;
  return (
    <Center
      w={width || 'full'}
      h="auto"
      borderBottomColor={getAccentColor(category)}
      borderBottomWidth="4px"
    >
      <HStack
        pl={6}
        pr={6}
        pb={2}
      >
        <Center>
          {IconFactory(icon)}
        </Center>
        <Center>
          <Heading as="h5" size="sm" m={0} p={0} fontWeight={700}>
            {type.toUpperCase()}
          </Heading>
        </Center>
      </HStack>
    </Center>
  );
});

const NodeWrapper = memo(({ children, data, selected }) => {
  const accentColor = useMemo(() => (getAccentColor(data?.category)), [data?.category]);

  const borderColor = useMemo(() => (selected ? shadeColor(accentColor, 0) : 'inherit'), [selected, accentColor]);

  return (
    <Center
      bg={useColorModeValue('rgba(247, 250, 252, 0.85)', 'rgba(45, 55, 72, 0.85)')}
      borderWidth={data?.invalid ? '2px' : '0.5px'}
      // borderColor={data.invalid ? 'red.400' : 'inherit'}
      borderColor={borderColor}
      borderRadius="lg"
      py={2}
      boxShadow="lg"
      // _hover={{ boxShadow: 'rgba(0, 0, 0, 0.40) 0px 0px 13px -3px', transform: 'translate(-1px, -1px)' }}
      // _active={{ boxShadow: 'rgba(0, 0, 0, 0.50) 0px 14px 18px -3px', transform: 'translate(-2px, -2px)' }}
      transition="0.15s ease-in-out"
      // opacity="90%"
      // sx={{
      //   backgroundColor: 'rgba(45, 55, 72, .90)',
      //   backdropFilter: 'blur(1px)',
      // }}
    >
      { children }
    </Center>
  );
});

// const UsableNode = ({ data, selected }) => {
//   useEffect(() => {
//     console.log('🚀 ~ file: createNodeTypes.jsx ~ line 262 ~ UsableNode ~ data', data);
//     const { inputData } = data;
//     if (inputData) {
//       // check if all required input data is there (node validity)
//       // post request to get the data
//       // set outputdata

//       console.log(`/run/${data.category}/${data.type}`);
//     }
//   }, [data.inputData]);

//   return (
//     <NodeWrapper data={data} selected={selected}>
//       <VStack minWidth="240px">
//         <NodeHeader data={data} />

//         {data.inputs.length && (
//         <Center>
//           <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
//             INPUTS
//           </Text>
//         </Center>
//         )}
//         <CreateUsableInputs data={data} />

//         {data.outputs.length && (
//         <Center>
//           <Text fontSize="xs" p={0} m={0} mt={-1} mb={-1} pt={-1} pb={-1}>
//             OUTPUTS
//           </Text>
//         </Center>
//         )}
//         <CreateUsableOutputs data={data} />

//         <BottomArea data={data} />
//       </VStack>
//     </NodeWrapper>
//   );
// };

export const createRepresentativeNode = (category, node) => (
  <NodeWrapper>
    <VStack>
      <NodeHeader data={{ category, type: node.name }} width="240px" />
    </VStack>
  </NodeWrapper>
);

export const createNodeTypes = (data) => {
  const nodesList = {};
  if (data) {
    data.forEach(({ category, nodes }) => {
      nodes.forEach((node) => {
        nodesList[node.name] = Node;
      });
    });
  }
  return nodesList;
};

export const createRepresentativeNodeTypes = (data) => {
  const nodesList = {};
  if (data) {
    data.forEach(({ category, nodes }) => {
      nodes.forEach((node) => {
        const newNode = () => (
          createRepresentativeNode(category, node)
        );
        nodesList[node.name] = newNode;
      });
    });
  }
  return nodesList;
};
