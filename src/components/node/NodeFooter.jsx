/* eslint-disable import/extensions */
/* eslint-disable import/prefer-default-export */
/* eslint-disable react/prop-types */
import {
  CheckCircleIcon, CloseIcon, CopyIcon, DeleteIcon, LockIcon, UnlockIcon, WarningIcon
} from '@chakra-ui/icons';
import {
  Center, Flex, Icon, Menu, MenuButton, MenuItem,
  MenuList, Portal, Spacer, Tooltip, useColorModeValue
} from '@chakra-ui/react';
import React, {
  memo, useContext
} from 'react';
import { MdMoreHoriz } from 'react-icons/md';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const NodeFooter = ({
  id, isValid = false, invalidReason = '', isLocked,
}) => {
  const {
    removeNodeById, duplicateNode, clearNode, useNodeLock,
  } = useContext(GlobalContext);

  const [, toggleLock] = useNodeLock(id);

  const iconShade = useColorModeValue('gray.400', 'gray.800');
  const validShade = useColorModeValue('gray.900', 'gray.100');
  // const invalidShade = useColorModeValue('red.200', 'red.900');
  const invalidShade = useColorModeValue('red.400', 'red.600');
  // const iconShade = useColorModeValue('gray.400', 'gray.800');

  return (
    <Flex w="full" pl={2} pr={2}>
      <Center>
        <Icon as={isLocked ? LockIcon : UnlockIcon} mt={-1} mb={-1} color={iconShade} onClick={() => toggleLock()} cursor="pointer" />
      </Center>
      <Spacer />
      <Tooltip
        label={isValid ? 'Node valid' : invalidReason}
        closeOnClick={false}
        hasArrow
        gutter={24}
        textAlign="center"
        borderRadius={8}
        py={1}
        px={2}
      >
        <Center my={-2}>
          <Center
            bgColor={isValid ? validShade : iconShade}
            borderRadius={100}
            p={1.5}
            mr={-3.5}
            my={-2}
          />
          <Icon
            as={isValid ? CheckCircleIcon : WarningIcon}
            // color={useColorModeValue('gray.400', 'gray.800')}
            color={isValid ? iconShade : invalidShade}
            cursor="default"
            my={-2}
          />

        </Center>
      </Tooltip>
      <Spacer />
      <Center>
        <Menu>
          <MenuButton as={Center} mb={-2} mt={-2} w={6} h={6} cursor="pointer" verticalAlign="middle">
            <Center>
              <Icon as={MdMoreHoriz} mb={-2} mt={-2} w={6} h={6} color={iconShade} />
            </Center>
          </MenuButton>
          <Portal>
            <MenuList>
              <MenuItem
                icon={<CopyIcon />}
                onClick={() => {
                  duplicateNode(id);
                }}
              >
                Duplicate
              </MenuItem>
              <MenuItem
                icon={<CloseIcon />}
                onClick={() => {
                  clearNode(id);
                }}
              >
                Clear
              </MenuItem>
              <MenuItem
                icon={<DeleteIcon />}
                onClick={() => {
                  removeNodeById(id);
                }}
              >
                Delete
              </MenuItem>
            </MenuList>
          </Portal>
        </Menu>
      </Center>
    </Flex>
  );
};

export default memo(NodeFooter);
