/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Button, Flex, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Switch, Text, VStack,
} from '@chakra-ui/react';
import React, { memo } from 'react';
import useLocalStorage from '../helpers/useLocalStorage.js';

function SettingsModal({ isOpen, onClose }) {
  const [isCpu, setIsCpu] = useLocalStorage('is-cpu', false);
  console.log('🚀 ~ file: SettingsModal.jsx ~ line 12 ~ SettingsModal ~ isCpu', isCpu);
  const [isFp16, setIsFp16] = useLocalStorage('is-fp16', false);
  console.log('🚀 ~ file: SettingsModal.jsx ~ line 14 ~ SettingsModal ~ isFp16', isFp16);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside" size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack w="full">
            <Flex align="center" w="full">
              <Text flex="1" textAlign="left">
                CPU mode
              </Text>
              <HStack>
                <Switch disabled size="lg" value={isCpu} defaultIsChecked={isCpu} onChange={() => { setIsCpu(!isCpu); }} />
              </HStack>
            </Flex>
            <Flex align="center" w="full">
              <Text flex="1" textAlign="left">
                FP16 mode
              </Text>
              <HStack>
                <Switch disabled size="lg" value={isFp16} defaultIsChecked={isFp16} onChange={() => { setIsFp16(!isFp16); }} />
              </HStack>
            </Flex>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default memo(SettingsModal);
