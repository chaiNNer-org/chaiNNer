/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input, InputGroup, InputLeftElement } from '@chakra-ui/react';
import { ipcRenderer } from 'electron';
import React, { memo, useContext } from 'react';
import { BsFolderPlus } from 'react-icons/bs';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const DirectoryInput = memo(({ label, data, index }) => {
  const { id } = data;
  const { useNodeData } = useContext(GlobalContext);
  const [nodeData, setNodeData] = useNodeData(id);

  const onButtonClick = async () => {
    const { canceled, filePaths } = await ipcRenderer.invoke('dir-select', nodeData?.sharedData?.path ?? '');
    const path = filePaths[0];
    if (!canceled && path) {
      const inputData = nodeData?.inputData ?? {};
      const sharedData = nodeData?.sharedData ?? {};
      inputData[index] = path;
      sharedData.path = path;
      setNodeData({ inputData, sharedData });
    }
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <InputGroup>
        <InputLeftElement
          pointerEvents="none"
        >
          <BsFolderPlus />
        </InputLeftElement>
        <Input
          placeholder="Select a directory..."
          value={nodeData?.sharedData?.path ?? ''}
          isReadOnly
          onClick={onButtonClick}
          isTruncated
        // bg={useColorModeValue('gray.500', 'gray.200')}
        // textColor={useColorModeValue('gray.200', 'gray.700')}
        // borderColor={useColorModeValue('gray.200', 'gray.700')}
        // _placeholder={{ color: useColorModeValue('gray.200', 'gray.700') }}
          draggable={false}
          cursor="pointer"
        />
      </InputGroup>
    </InputContainer>
  );
});

export default DirectoryInput;
