/* eslint-disable import/extensions */
/* eslint-disable import/prefer-default-export */
/* eslint-disable react/prop-types */
import {
  CheckCircleIcon, CloseIcon, CopyIcon, DeleteIcon, LockIcon, UnlockIcon, WarningIcon,
} from '@chakra-ui/icons';
import {
  Center, Flex, Icon, Menu, MenuButton, MenuItem,
  MenuList, Portal, Spacer, Tooltip, useColorModeValue,
} from '@chakra-ui/react';
import React, {
  memo, useContext,
} from 'react';
import { MdMoreHoriz } from 'react-icons/md';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const NodeFooter = ({
  id, validity, isLocked, toggleLock,
}) => {
  const {
    removeNodeById, duplicateNode, clearNode,
  } = useContext(GlobalContext);

  const [isValid, invalidReason] = validity;

  return (
    <Flex w="full" pl={2} pr={2}>
      <Center>
        <Icon as={isLocked ? LockIcon : UnlockIcon} mt={-1} mb={-1} color={useColorModeValue('gray.300', 'gray.800')} onClick={() => toggleLock()} cursor="pointer" />
      </Center>
      <Spacer />
      <Tooltip
        label={isValid ? 'Node valid' : invalidReason}
        closeOnClick={false}
        hasArrow
        gutter={24}
        textAlign="center"
      >
        <Center>
          <Icon as={isValid ? CheckCircleIcon : WarningIcon} mt={-1} mb={-1} color={useColorModeValue('gray.300', 'gray.800')} cursor="default" />
        </Center>
      </Tooltip>
      <Spacer />
      <Center>
        <Menu>
          <MenuButton as={Center} mb={-2} mt={-2} w={6} h={6} cursor="pointer" verticalAlign="middle">
            <Center>
              <Icon as={MdMoreHoriz} mb={-2} mt={-2} w={6} h={6} color={useColorModeValue('gray.300', 'gray.800')} />
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
